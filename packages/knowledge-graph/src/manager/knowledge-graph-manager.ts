import type { GraphSnapshot } from "../domain/graph-snapshot.js";
import type {
  CreateKnowledgeEdgeInput,
  KnowledgeEdge,
  UpdateKnowledgeEdgeInput,
} from "../domain/knowledge-edge.js";
import type { CreateKnowledgeGraphInput, KnowledgeGraph } from "../domain/knowledge-graph.js";
import type {
  CreateKnowledgeNodeInput,
  KnowledgeNode,
  UpdateKnowledgeNodeInput,
} from "../domain/knowledge-node.js";
import { GraphConfigurationException } from "../errors/graph-configuration-exception.js";
import { KnowledgeGraphEventType } from "../events/knowledge-graph-event-type.js";
import { GraphEngine } from "../graph/graph-engine.js";
import { mergeGraphs, type GraphMergeConflictResolution } from "../graph/graph-merge.js";
import { extractSubGraph } from "../graph/graph-subgraph.js";
import { GraphOperationType } from "../pipeline/graph-operation-type.js";
import { DEFAULT_CONFIGURATION_KEY } from "../registry/configuration-registry.js";

import type { GraphSystemContext } from "./graph-system-context.js";

export interface KnowledgeGraphManagerOptions {
  readonly actor?: string;
}

/**
 * Owns the graph-scoped and node/edge-scoped Graph Operations: Create/Delete/Clone/Snapshot/
 * Restore/Merge Graph, and Node/Edge CRUD (including Move Node / Copy Node). Every mutating
 * operation runs through `GraphOperationPipeline` so Validation/Authorization/Metrics/Events are
 * applied uniformly; pure lookups (Find Node(s)/Find Edge(s)) bypass the pipeline since they
 * cannot fail authorization/validation in a way distinct from "not found".
 */
export class KnowledgeGraphManager {
  constructor(private readonly ctx: GraphSystemContext) {}

  private configFor(graphId: string) {
    return this.ctx.configurationRegistry.resolveFor(graphId);
  }

  // ---- Graph lifecycle ----

  createGraph(
    input: CreateKnowledgeGraphInput,
    options: KnowledgeGraphManagerOptions = {},
  ): KnowledgeGraph {
    return this.ctx.pipeline.execute(
      {
        operation: GraphOperationType.CreateGraph,
        actor: options.actor,
        graphId: input.id,
        validate: () => {
          if (!input.name || input.name.trim().length === 0) {
            throw new GraphConfigurationException("Graph name must be a non-empty string", {
              input,
            });
          }
        },
        execute: () => {
          const created = this.ctx.graphFactory.create(input);
          this.ctx.graphRegistry.register(created);
          return created.graph;
        },
        recordMetrics: () => this.ctx.metricsCollector.recordGraphCreated(),
        emitEvents: (graph) =>
          this.ctx.eventPublisher.publish(KnowledgeGraphEventType.GraphCreated, { graph }),
      },
      this.configFor(DEFAULT_CONFIGURATION_KEY),
    );
  }

  deleteGraph(graphId: string, options: KnowledgeGraphManagerOptions = {}): void {
    this.ctx.pipeline.execute(
      {
        operation: GraphOperationType.DeleteGraph,
        actor: options.actor,
        graphId,
        validate: () => this.ctx.graphRegistry.get(graphId),
        execute: () => {
          const engine = this.ctx.graphRegistry.get(graphId);
          for (const node of engine.listNodes()) {
            this.ctx.nodeRegistry.remove(node.id);
          }
          for (const edge of engine.listEdges()) {
            this.ctx.edgeRegistry.remove(edge.id);
            this.ctx.relationshipRegistry.remove(edge.id);
          }
          this.ctx.graphRegistry.remove(graphId);
          this.ctx.configurationRegistry.remove(graphId);
          return graphId;
        },
        recordMetrics: () => this.ctx.metricsCollector.recordGraphDeleted(),
        emitEvents: (id) =>
          this.ctx.eventPublisher.publish(KnowledgeGraphEventType.GraphDeleted, { graphId: id }),
      },
      this.configFor(graphId),
    );
  }

  cloneGraph(
    graphId: string,
    newGraphId?: string,
    options: KnowledgeGraphManagerOptions = {},
  ): KnowledgeGraph {
    return this.ctx.pipeline.execute(
      {
        operation: GraphOperationType.CloneGraph,
        actor: options.actor,
        graphId,
        validate: () => this.ctx.graphRegistry.get(graphId),
        execute: () => {
          const source = this.ctx.graphRegistry.get(graphId);
          const cloned = source.clone(newGraphId);
          this.ctx.graphRegistry.register(cloned);
          for (const node of cloned.listNodes()) {
            this.ctx.nodeRegistry.put(cloned.graph.id, node);
          }
          for (const edge of cloned.listEdges()) {
            this.ctx.edgeRegistry.put(cloned.graph.id, edge);
          }
          return cloned.graph;
        },
        recordMetrics: () => this.ctx.metricsCollector.recordGraphCreated(),
        emitEvents: (graph) =>
          this.ctx.eventPublisher.publish(KnowledgeGraphEventType.GraphCreated, { graph }),
      },
      this.configFor(graphId),
    );
  }

  snapshotGraph(
    graphId: string,
    label?: string,
    options: KnowledgeGraphManagerOptions = {},
  ): GraphSnapshot {
    return this.ctx.pipeline.execute(
      {
        operation: GraphOperationType.SnapshotGraph,
        actor: options.actor,
        graphId,
        validate: () => this.ctx.graphRegistry.get(graphId),
        execute: () => {
          const engine = this.ctx.graphRegistry.get(graphId);
          const snapshot = this.ctx.snapshotFactory.create(engine, label);
          this.ctx.snapshotRegistry.register(snapshot);
          return snapshot;
        },
        emitEvents: (snapshot) =>
          this.ctx.eventPublisher.publish(KnowledgeGraphEventType.SnapshotCreated, { snapshot }),
      },
      this.configFor(graphId),
    );
  }

  /** Restores a graph's nodes/edges (in place, same graph id) from a previously taken snapshot. */
  restoreGraph(snapshotId: string, options: KnowledgeGraphManagerOptions = {}): KnowledgeGraph {
    const snapshot = this.ctx.snapshotRegistry.get(snapshotId);
    return this.ctx.pipeline.execute(
      {
        operation: GraphOperationType.RestoreGraph,
        actor: options.actor,
        graphId: snapshot.graphId,
        validate: () => this.ctx.graphRegistry.get(snapshot.graphId),
        execute: () => {
          const existing = this.ctx.graphRegistry.get(snapshot.graphId);
          for (const node of existing.listNodes()) this.ctx.nodeRegistry.remove(node.id);
          for (const edge of existing.listEdges()) {
            this.ctx.edgeRegistry.remove(edge.id);
            this.ctx.relationshipRegistry.remove(edge.id);
          }

          const restoredAggregate: KnowledgeGraph = {
            id: existing.graph.id,
            name: existing.graph.name,
            description: existing.graph.description,
            nodes: new Map(snapshot.nodes.map((node) => [node.id, node])),
            edges: new Map(snapshot.edges.map((edge) => [edge.id, edge])),
            createdAt: existing.graph.createdAt,
            updatedAt: Date.now(),
            version: snapshot.version,
          };
          const restored = GraphEngine.wrap(restoredAggregate);
          this.ctx.graphRegistry.remove(snapshot.graphId);
          this.ctx.graphRegistry.register(restored);
          for (const node of restored.listNodes())
            this.ctx.nodeRegistry.put(restored.graph.id, node);
          for (const edge of restored.listEdges())
            this.ctx.edgeRegistry.put(restored.graph.id, edge);
          return restored.graph;
        },
        emitEvents: (graph) =>
          this.ctx.eventPublisher.publish(KnowledgeGraphEventType.GraphCreated, {
            graph,
            restoredFromSnapshotId: snapshotId,
          }),
      },
      this.configFor(snapshot.graphId),
    );
  }

  mergeGraph(
    targetGraphId: string,
    sourceGraphId: string,
    resolution: GraphMergeConflictResolution = "keep-target",
    options: KnowledgeGraphManagerOptions = {},
  ) {
    return this.ctx.pipeline.execute(
      {
        operation: GraphOperationType.MergeGraph,
        actor: options.actor,
        graphId: targetGraphId,
        validate: () => {
          this.ctx.graphRegistry.get(targetGraphId);
          this.ctx.graphRegistry.get(sourceGraphId);
        },
        execute: () => {
          const target = this.ctx.graphRegistry.get(targetGraphId);
          const source = this.ctx.graphRegistry.get(sourceGraphId);
          const result = mergeGraphs(target, source, resolution);
          for (const node of target.listNodes()) this.ctx.nodeRegistry.put(target.graph.id, node);
          for (const edge of target.listEdges()) this.ctx.edgeRegistry.put(target.graph.id, edge);
          return result;
        },
        emitEvents: (result) =>
          this.ctx.eventPublisher.publish(KnowledgeGraphEventType.GraphMerged, {
            targetGraphId,
            sourceGraphId,
            result,
          }),
      },
      this.configFor(targetGraphId),
    );
  }

  extractSubGraph(
    graphId: string,
    nodeIds: readonly string[],
    name: string,
    options: KnowledgeGraphManagerOptions = {},
  ): KnowledgeGraph {
    return this.ctx.pipeline.execute(
      {
        operation: GraphOperationType.SubGraph,
        actor: options.actor,
        graphId,
        validate: () => this.ctx.graphRegistry.get(graphId),
        execute: () => {
          const source = this.ctx.graphRegistry.get(graphId);
          const subGraph = extractSubGraph(source, nodeIds, name);
          this.ctx.graphRegistry.register(subGraph);
          for (const node of subGraph.listNodes())
            this.ctx.nodeRegistry.put(subGraph.graph.id, node);
          for (const edge of subGraph.listEdges())
            this.ctx.edgeRegistry.put(subGraph.graph.id, edge);
          return subGraph.graph;
        },
        emitEvents: (graph) =>
          this.ctx.eventPublisher.publish(KnowledgeGraphEventType.GraphCreated, { graph }),
      },
      this.configFor(graphId),
    );
  }

  // ---- Node CRUD ----

  createNode(
    graphId: string,
    input: CreateKnowledgeNodeInput,
    options: KnowledgeGraphManagerOptions = {},
  ): KnowledgeNode {
    return this.ctx.pipeline.execute(
      {
        operation: GraphOperationType.CreateNode,
        actor: options.actor,
        graphId,
        engine: this.ctx.graphRegistry.tryGet(graphId),
        validate: () => this.ctx.graphRegistry.get(graphId),
        execute: () => {
          const engine = this.ctx.graphRegistry.get(graphId);
          const node = this.ctx.nodeFactory.create(input);
          engine.addNode(node);
          this.ctx.nodeRegistry.register(graphId, node);
          return node;
        },
        recordMetrics: () => this.ctx.metricsCollector.recordNodeCreated(),
        emitEvents: (node) =>
          this.ctx.eventPublisher.publish(KnowledgeGraphEventType.NodeCreated, { graphId, node }),
      },
      this.configFor(graphId),
    );
  }

  updateNode(
    graphId: string,
    nodeId: string,
    input: UpdateKnowledgeNodeInput,
    options: KnowledgeGraphManagerOptions = {},
  ): KnowledgeNode {
    return this.ctx.pipeline.execute(
      {
        operation: GraphOperationType.UpdateNode,
        actor: options.actor,
        graphId,
        validate: () => this.ctx.graphRegistry.get(graphId).getNode(nodeId),
        execute: () => {
          const engine = this.ctx.graphRegistry.get(graphId);
          const updated = this.ctx.nodeUpdater.apply(engine.getNode(nodeId), input);
          engine.replaceNode(updated);
          this.ctx.nodeRegistry.put(graphId, updated);
          return updated;
        },
        emitEvents: (node) =>
          this.ctx.eventPublisher.publish(KnowledgeGraphEventType.NodeUpdated, { graphId, node }),
      },
      this.configFor(graphId),
    );
  }

  deleteNode(
    graphId: string,
    nodeId: string,
    options: KnowledgeGraphManagerOptions = {},
  ): KnowledgeNode {
    let cascadedEdgeCount = 0;
    return this.ctx.pipeline.execute(
      {
        operation: GraphOperationType.DeleteNode,
        actor: options.actor,
        graphId,
        validate: () => this.ctx.graphRegistry.get(graphId).getNode(nodeId),
        execute: () => {
          const engine = this.ctx.graphRegistry.get(graphId);
          const node = engine.getNode(nodeId);
          const removedEdgeIds = engine.removeNode(nodeId);
          this.ctx.nodeRegistry.remove(nodeId);
          for (const edgeId of removedEdgeIds) {
            this.ctx.edgeRegistry.remove(edgeId);
            this.ctx.relationshipRegistry.remove(edgeId);
          }
          cascadedEdgeCount = removedEdgeIds.length;
          return node;
        },
        // Cascade-deleted edges must also be reflected in edgeCount/relationshipCount — Delete
        // Node's Metrics stage decrements once for the node itself plus once per cascaded edge, so
        // the gauges never drift from what the registries actually contain after the cascade.
        recordMetrics: () => {
          this.ctx.metricsCollector.recordNodeDeleted();
          for (let i = 0; i < cascadedEdgeCount; i += 1) {
            this.ctx.metricsCollector.recordEdgeDeleted();
          }
        },
        emitEvents: (node) =>
          this.ctx.eventPublisher.publish(KnowledgeGraphEventType.NodeDeleted, { graphId, node }),
      },
      this.configFor(graphId),
    );
  }

  /** Cuts a node (and cascades its incident edges) from `fromGraphId` and inserts it, same id, into `toGraphId`. */
  moveNode(
    nodeId: string,
    fromGraphId: string,
    toGraphId: string,
    options: KnowledgeGraphManagerOptions = {},
  ): KnowledgeNode {
    let cascadedEdgeCount = 0;
    return this.ctx.pipeline.execute(
      {
        operation: GraphOperationType.MoveNode,
        actor: options.actor,
        graphId: toGraphId,
        validate: () => {
          this.ctx.graphRegistry.get(fromGraphId).getNode(nodeId);
          this.ctx.graphRegistry.get(toGraphId);
        },
        execute: () => {
          const fromEngine = this.ctx.graphRegistry.get(fromGraphId);
          const toEngine = this.ctx.graphRegistry.get(toGraphId);
          const node = fromEngine.getNode(nodeId);
          const removedEdgeIds = fromEngine.removeNode(nodeId);
          for (const edgeId of removedEdgeIds) {
            this.ctx.edgeRegistry.remove(edgeId);
            this.ctx.relationshipRegistry.remove(edgeId);
          }
          cascadedEdgeCount = removedEdgeIds.length;
          toEngine.addNode(node);
          this.ctx.nodeRegistry.put(toGraphId, node);
          return node;
        },
        // Move Node cascades incident-edge removal from the source graph (edges cannot follow a
        // node across graphs, since both endpoints must live in the same graph) — reflect that in
        // the edge/relationship gauges just like Delete Node does.
        recordMetrics: () => {
          for (let i = 0; i < cascadedEdgeCount; i += 1) {
            this.ctx.metricsCollector.recordEdgeDeleted();
          }
        },
        emitEvents: (node) =>
          this.ctx.eventPublisher.publish(KnowledgeGraphEventType.NodeUpdated, {
            graphId: toGraphId,
            node,
            movedFromGraphId: fromGraphId,
          }),
      },
      this.configFor(toGraphId),
    );
  }

  /** Duplicates a node's type/label/metadata as a brand-new node (new id) in `toGraphId`. Edges are NOT copied. */
  copyNode(
    nodeId: string,
    fromGraphId: string,
    toGraphId: string,
    options: KnowledgeGraphManagerOptions = {},
  ): KnowledgeNode {
    return this.ctx.pipeline.execute(
      {
        operation: GraphOperationType.CopyNode,
        actor: options.actor,
        graphId: toGraphId,
        validate: () => {
          this.ctx.graphRegistry.get(fromGraphId).getNode(nodeId);
          this.ctx.graphRegistry.get(toGraphId);
        },
        execute: () => {
          const source = this.ctx.graphRegistry.get(fromGraphId).getNode(nodeId);
          const toEngine = this.ctx.graphRegistry.get(toGraphId);
          const copy = this.ctx.nodeFactory.create({
            type: source.type,
            customTypeLabel: source.customTypeLabel,
            label: source.label,
            metadata: source.metadata,
          });
          toEngine.addNode(copy);
          this.ctx.nodeRegistry.register(toGraphId, copy);
          return copy;
        },
        recordMetrics: () => this.ctx.metricsCollector.recordNodeCreated(),
        emitEvents: (node) =>
          this.ctx.eventPublisher.publish(KnowledgeGraphEventType.NodeCreated, {
            graphId: toGraphId,
            node,
            copiedFromNodeId: nodeId,
          }),
      },
      this.configFor(toGraphId),
    );
  }

  findNode(graphId: string, nodeId: string): KnowledgeNode {
    return this.ctx.graphRegistry.get(graphId).getNode(nodeId);
  }

  findNodes(graphId: string, predicate?: (node: KnowledgeNode) => boolean): KnowledgeNode[] {
    const nodes = this.ctx.graphRegistry.get(graphId).listNodes();
    return predicate ? nodes.filter(predicate) : nodes;
  }

  // ---- Edge CRUD ----

  createEdge(
    graphId: string,
    input: CreateKnowledgeEdgeInput,
    options: KnowledgeGraphManagerOptions = {},
  ): KnowledgeEdge {
    const engine = this.ctx.graphRegistry.tryGet(graphId);
    return this.ctx.pipeline.execute(
      {
        operation: GraphOperationType.CreateEdge,
        actor: options.actor,
        graphId,
        engine,
        relationshipCandidate: {
          sourceNodeId: input.sourceNodeId,
          targetNodeId: input.targetNodeId,
          edgeType: input.type,
        },
        checkCycles: true,
        validate: () => this.ctx.graphRegistry.get(graphId),
        execute: () => {
          const target = this.ctx.graphRegistry.get(graphId);
          const edge = this.ctx.edgeFactory.create(input);
          target.addEdge(edge);
          this.ctx.edgeRegistry.register(graphId, edge);
          this.ctx.relationshipRegistry.register({
            edgeId: edge.id,
            type: edge.type,
            sourceNodeId: edge.sourceNodeId,
            targetNodeId: edge.targetNodeId,
            weight: edge.weight,
          });
          return edge;
        },
        recordMetrics: () => this.ctx.metricsCollector.recordEdgeCreated(),
        emitEvents: (edge) => {
          this.ctx.eventPublisher.publish(KnowledgeGraphEventType.EdgeCreated, { graphId, edge });
          this.ctx.eventPublisher.publish(KnowledgeGraphEventType.RelationshipCreated, {
            graphId,
            edge,
          });
        },
      },
      this.configFor(graphId),
    );
  }

  updateEdge(
    graphId: string,
    edgeId: string,
    input: UpdateKnowledgeEdgeInput,
    options: KnowledgeGraphManagerOptions = {},
  ): KnowledgeEdge {
    return this.ctx.pipeline.execute(
      {
        operation: GraphOperationType.UpdateEdge,
        actor: options.actor,
        graphId,
        validate: () => this.ctx.graphRegistry.get(graphId).getEdge(edgeId),
        execute: () => {
          const engine = this.ctx.graphRegistry.get(graphId);
          const updated = this.ctx.edgeUpdater.apply(engine.getEdge(edgeId), input);
          engine.replaceEdge(updated);
          this.ctx.edgeRegistry.put(graphId, updated);
          this.ctx.relationshipRegistry.put({
            edgeId: updated.id,
            type: updated.type,
            sourceNodeId: updated.sourceNodeId,
            targetNodeId: updated.targetNodeId,
            weight: updated.weight,
          });
          return updated;
        },
        emitEvents: (edge) =>
          this.ctx.eventPublisher.publish(KnowledgeGraphEventType.EdgeCreated, {
            graphId,
            edge,
            updated: true,
          }),
      },
      this.configFor(graphId),
    );
  }

  deleteEdge(
    graphId: string,
    edgeId: string,
    options: KnowledgeGraphManagerOptions = {},
  ): KnowledgeEdge {
    return this.ctx.pipeline.execute(
      {
        operation: GraphOperationType.DeleteEdge,
        actor: options.actor,
        graphId,
        validate: () => this.ctx.graphRegistry.get(graphId).getEdge(edgeId),
        execute: () => {
          const engine = this.ctx.graphRegistry.get(graphId);
          const edge = engine.removeEdge(edgeId);
          this.ctx.edgeRegistry.remove(edgeId);
          this.ctx.relationshipRegistry.remove(edgeId);
          return edge;
        },
        recordMetrics: () => this.ctx.metricsCollector.recordEdgeDeleted(),
        emitEvents: (edge) => {
          this.ctx.eventPublisher.publish(KnowledgeGraphEventType.EdgeDeleted, { graphId, edge });
          this.ctx.eventPublisher.publish(KnowledgeGraphEventType.RelationshipDeleted, {
            graphId,
            edge,
          });
        },
      },
      this.configFor(graphId),
    );
  }

  findEdge(graphId: string, edgeId: string): KnowledgeEdge {
    return this.ctx.graphRegistry.get(graphId).getEdge(edgeId);
  }

  findEdges(graphId: string, predicate?: (edge: KnowledgeEdge) => boolean): KnowledgeEdge[] {
    const edges = this.ctx.graphRegistry.get(graphId).listEdges();
    return predicate ? edges.filter(predicate) : edges;
  }
}
