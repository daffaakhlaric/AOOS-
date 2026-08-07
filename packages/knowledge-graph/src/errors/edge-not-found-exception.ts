import { KnowledgeGraphException } from "./knowledge-graph-exception.js";

/** Thrown when an Edge Registry lookup, or a graph-scoped edge lookup, finds no `KnowledgeEdge`. */
export class EdgeNotFoundException extends KnowledgeGraphException {
  constructor(edgeId: string) {
    super(`Edge not found: ${edgeId}`, { code: "EDGE_NOT_FOUND", context: { edgeId } });
  }
}
