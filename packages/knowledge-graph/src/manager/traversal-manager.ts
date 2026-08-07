import type { GraphPath } from "../domain/graph-path.js";
import type { GraphTraversal } from "../domain/graph-traversal.js";
import type { KnowledgeEdgeType } from "../domain/knowledge-edge-type.js";
import type { KnowledgeGraph } from "../domain/knowledge-graph.js";
import { KnowledgeGraphEventType } from "../events/knowledge-graph-event-type.js";
import {
  breadthFirstSearch,
  depthFirstSearch,
  findAncestors,
  findDescendants,
  findNeighbors,
  shortestPath,
  type NeighborDirection,
  type TraversalOptions,
} from "../traversal/index.js";

import type { GraphSystemContext } from "./graph-system-context.js";
import type { KnowledgeGraphManager } from "./knowledge-graph-manager.js";

/**
 * Owns the traversal-shaped Graph Operations: Breadth First Search, Depth First Search, Shortest
 * Path, Find Neighbors, Find Ancestors, Find Descendants, and Sub Graph (extraction is a
 * traversal-adjacent concern — "which nodes are reachable" — even though it's implemented by
 * `KnowledgeGraphManager` since it also registers a brand-new graph). Every traversal call also
 * records its duration into `KnowledgeGraphMonitor` (Traversal Time / Performance dimensions) and
 * bumps the Traversal Count metric, and publishes `TraversalExecuted`.
 */
export class TraversalManager {
  constructor(
    private readonly ctx: GraphSystemContext,
    private readonly graphManager: KnowledgeGraphManager,
  ) {}

  private record(graphId: string, result: GraphTraversal): void {
    this.ctx.metricsCollector.recordTraversal();
    this.ctx.monitor.recordTraversalDuration(result.durationMs);
    this.ctx.eventPublisher.publish(KnowledgeGraphEventType.TraversalExecuted, {
      graphId,
      result,
    });
  }

  breadthFirstSearch(
    graphId: string,
    startNodeId: string,
    options: TraversalOptions = {},
  ): GraphTraversal {
    const engine = this.ctx.graphRegistry.get(graphId);
    const result = breadthFirstSearch(engine, startNodeId, options);
    this.record(graphId, result);
    return result;
  }

  depthFirstSearch(
    graphId: string,
    startNodeId: string,
    options: TraversalOptions = {},
  ): GraphTraversal {
    const engine = this.ctx.graphRegistry.get(graphId);
    const result = depthFirstSearch(engine, startNodeId, options);
    this.record(graphId, result);
    return result;
  }

  shortestPath(graphId: string, startNodeId: string, endNodeId: string): GraphPath | undefined {
    const engine = this.ctx.graphRegistry.get(graphId);
    return shortestPath(engine, startNodeId, endNodeId);
  }

  findNeighbors(
    graphId: string,
    nodeId: string,
    direction: NeighborDirection = "both",
    edgeTypes?: readonly KnowledgeEdgeType[],
  ): string[] {
    const engine = this.ctx.graphRegistry.get(graphId);
    return findNeighbors(engine, nodeId, direction, edgeTypes);
  }

  findAncestors(
    graphId: string,
    nodeId: string,
    edgeTypes?: readonly KnowledgeEdgeType[],
  ): string[] {
    const engine = this.ctx.graphRegistry.get(graphId);
    return findAncestors(engine, nodeId, edgeTypes);
  }

  findDescendants(
    graphId: string,
    nodeId: string,
    edgeTypes?: readonly KnowledgeEdgeType[],
  ): string[] {
    const engine = this.ctx.graphRegistry.get(graphId);
    return findDescendants(engine, nodeId, edgeTypes);
  }

  subGraph(
    graphId: string,
    nodeIds: readonly string[],
    name: string,
    options: { readonly actor?: string } = {},
  ): KnowledgeGraph {
    return this.graphManager.extractSubGraph(graphId, nodeIds, name, options);
  }
}
