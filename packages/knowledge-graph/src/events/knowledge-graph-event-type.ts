/**
 * The 13 domain events from the specification. Dotted, namespaced convention:
 * `knowledge.graph.<subject>.<verb>` for graph-scoped events (mirrors the AOS platform-wide event
 * naming convention observed across sibling packages) with the graph/node/edge subject inline.
 */
export enum KnowledgeGraphEventType {
  GraphCreated = "knowledge.graph.created",
  GraphDeleted = "knowledge.graph.deleted",
  NodeCreated = "knowledge.graph.node.created",
  NodeUpdated = "knowledge.graph.node.updated",
  NodeDeleted = "knowledge.graph.node.deleted",
  EdgeCreated = "knowledge.graph.edge.created",
  EdgeDeleted = "knowledge.graph.edge.deleted",
  RelationshipCreated = "knowledge.graph.relationship.created",
  RelationshipDeleted = "knowledge.graph.relationship.deleted",
  TraversalExecuted = "knowledge.graph.traversal.executed",
  GraphValidated = "knowledge.graph.validated",
  SnapshotCreated = "knowledge.graph.snapshot.created",
  GraphMerged = "knowledge.graph.merged",
}
