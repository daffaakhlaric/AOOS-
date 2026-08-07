import { KnowledgeGraphException } from "./knowledge-graph-exception.js";

/** Thrown when a Node Registry lookup, or a graph-scoped node lookup, finds no `KnowledgeNode`. */
export class NodeNotFoundException extends KnowledgeGraphException {
  constructor(nodeId: string) {
    super(`Node not found: ${nodeId}`, { code: "NODE_NOT_FOUND", context: { nodeId } });
  }
}
