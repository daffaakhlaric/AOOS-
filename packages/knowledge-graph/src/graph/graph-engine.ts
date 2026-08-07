import type { KnowledgeEdge } from "../domain/knowledge-edge.js";
import type { CreateKnowledgeGraphInput, KnowledgeGraph } from "../domain/knowledge-graph.js";
import type { KnowledgeNode } from "../domain/knowledge-node.js";
import { EdgeNotFoundException } from "../errors/edge-not-found-exception.js";
import { NodeNotFoundException } from "../errors/node-not-found-exception.js";
import { deepClone, generateId, now } from "../utils/index.js";

/**
 * The real in-memory graph data structure. Wraps a `KnowledgeGraph` aggregate and maintains
 * `Map<nodeId, Set<edgeId>>` outgoing/incoming adjacency indexes, updated incrementally on every
 * mutation so lookups used by traversal algorithms stay O(1) amortized per neighbor.
 *
 * This is the ONLY place adjacency bookkeeping lives — traversal/analytics/reasoning algorithms
 * consume `GraphEngine`'s adjacency accessors rather than re-deriving them.
 */
export class GraphEngine {
  private readonly outgoing = new Map<string, Set<string>>();
  private readonly incoming = new Map<string, Set<string>>();

  private constructor(private readonly aggregate: KnowledgeGraph) {
    for (const edge of aggregate.edges.values()) {
      this.indexEdge(edge);
    }
  }

  static create(input: CreateKnowledgeGraphInput): GraphEngine {
    const timestamp = now();
    const aggregate: KnowledgeGraph = {
      id: input.id ?? generateId("graph"),
      name: input.name,
      description: input.description,
      nodes: new Map(),
      edges: new Map(),
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 0,
    };
    return new GraphEngine(aggregate);
  }

  static wrap(aggregate: KnowledgeGraph): GraphEngine {
    return new GraphEngine(aggregate);
  }

  get graph(): KnowledgeGraph {
    return this.aggregate;
  }

  private indexEdge(edge: KnowledgeEdge): void {
    if (!this.outgoing.has(edge.sourceNodeId)) this.outgoing.set(edge.sourceNodeId, new Set());
    if (!this.incoming.has(edge.targetNodeId)) this.incoming.set(edge.targetNodeId, new Set());
    this.outgoing.get(edge.sourceNodeId)!.add(edge.id);
    this.incoming.get(edge.targetNodeId)!.add(edge.id);
  }

  private unindexEdge(edge: KnowledgeEdge): void {
    this.outgoing.get(edge.sourceNodeId)?.delete(edge.id);
    this.incoming.get(edge.targetNodeId)?.delete(edge.id);
  }

  private touch(): void {
    this.aggregate.updatedAt = now();
  }

  // ---- Node CRUD ----

  addNode(node: KnowledgeNode): KnowledgeNode {
    this.aggregate.nodes.set(node.id, node);
    if (!this.outgoing.has(node.id)) this.outgoing.set(node.id, new Set());
    if (!this.incoming.has(node.id)) this.incoming.set(node.id, new Set());
    this.touch();
    return node;
  }

  replaceNode(node: KnowledgeNode): KnowledgeNode {
    if (!this.aggregate.nodes.has(node.id)) {
      throw new NodeNotFoundException(node.id);
    }
    this.aggregate.nodes.set(node.id, node);
    this.touch();
    return node;
  }

  getNode(nodeId: string): KnowledgeNode {
    const node = this.aggregate.nodes.get(nodeId);
    if (!node) throw new NodeNotFoundException(nodeId);
    return node;
  }

  tryGetNode(nodeId: string): KnowledgeNode | undefined {
    return this.aggregate.nodes.get(nodeId);
  }

  hasNode(nodeId: string): boolean {
    return this.aggregate.nodes.has(nodeId);
  }

  listNodes(): KnowledgeNode[] {
    return Array.from(this.aggregate.nodes.values());
  }

  /** Removes a node and every edge incident to it (cascade delete). Returns the removed edge ids. */
  removeNode(nodeId: string): string[] {
    if (!this.aggregate.nodes.has(nodeId)) {
      throw new NodeNotFoundException(nodeId);
    }
    const incidentEdgeIds = new Set<string>([
      ...(this.outgoing.get(nodeId) ?? []),
      ...(this.incoming.get(nodeId) ?? []),
    ]);
    for (const edgeId of incidentEdgeIds) {
      this.removeEdge(edgeId);
    }
    this.aggregate.nodes.delete(nodeId);
    this.outgoing.delete(nodeId);
    this.incoming.delete(nodeId);
    this.touch();
    return Array.from(incidentEdgeIds);
  }

  // ---- Edge CRUD ----

  addEdge(edge: KnowledgeEdge): KnowledgeEdge {
    if (!this.aggregate.nodes.has(edge.sourceNodeId)) {
      throw new NodeNotFoundException(edge.sourceNodeId);
    }
    if (!this.aggregate.nodes.has(edge.targetNodeId)) {
      throw new NodeNotFoundException(edge.targetNodeId);
    }
    this.aggregate.edges.set(edge.id, edge);
    this.indexEdge(edge);
    this.touch();
    return edge;
  }

  replaceEdge(edge: KnowledgeEdge): KnowledgeEdge {
    const existing = this.aggregate.edges.get(edge.id);
    if (!existing) throw new EdgeNotFoundException(edge.id);
    this.aggregate.edges.set(edge.id, edge);
    this.touch();
    return edge;
  }

  getEdge(edgeId: string): KnowledgeEdge {
    const edge = this.aggregate.edges.get(edgeId);
    if (!edge) throw new EdgeNotFoundException(edgeId);
    return edge;
  }

  tryGetEdge(edgeId: string): KnowledgeEdge | undefined {
    return this.aggregate.edges.get(edgeId);
  }

  hasEdge(edgeId: string): boolean {
    return this.aggregate.edges.has(edgeId);
  }

  listEdges(): KnowledgeEdge[] {
    return Array.from(this.aggregate.edges.values());
  }

  removeEdge(edgeId: string): KnowledgeEdge {
    const edge = this.aggregate.edges.get(edgeId);
    if (!edge) throw new EdgeNotFoundException(edgeId);
    this.unindexEdge(edge);
    this.aggregate.edges.delete(edgeId);
    this.touch();
    return edge;
  }

  // ---- Adjacency ----

  outgoingEdges(nodeId: string): KnowledgeEdge[] {
    const ids = this.outgoing.get(nodeId) ?? new Set<string>();
    return Array.from(ids).map((id) => this.getEdge(id));
  }

  incomingEdges(nodeId: string): KnowledgeEdge[] {
    const ids = this.incoming.get(nodeId) ?? new Set<string>();
    return Array.from(ids).map((id) => this.getEdge(id));
  }

  /** Neighbor node ids reachable via outgoing edges, optionally filtered to specific edge types. */
  outgoingNeighborIds(nodeId: string, edgeTypes?: ReadonlySet<string>): string[] {
    return this.outgoingEdges(nodeId)
      .filter((edge) => !edgeTypes || edgeTypes.has(edge.type))
      .map((edge) => edge.targetNodeId);
  }

  /** Neighbor node ids reachable via incoming edges, optionally filtered to specific edge types. */
  incomingNeighborIds(nodeId: string, edgeTypes?: ReadonlySet<string>): string[] {
    return this.incomingEdges(nodeId)
      .filter((edge) => !edgeTypes || edgeTypes.has(edge.type))
      .map((edge) => edge.sourceNodeId);
  }

  // ---- Whole-graph operations ----

  /** Deep-clones the wrapped aggregate (including a fresh version bump) into a new `GraphEngine`. */
  clone(newId?: string): GraphEngine {
    const deepClonedAggregate = deepClone(this.aggregate);
    const timestamp = now();
    const clonedAggregate: KnowledgeGraph = {
      ...deepClonedAggregate,
      id: newId ?? generateId("graph"),
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 0,
    };
    return GraphEngine.wrap(clonedAggregate);
  }
}
