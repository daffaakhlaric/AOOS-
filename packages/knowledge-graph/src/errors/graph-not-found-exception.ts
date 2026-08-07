import { KnowledgeGraphException } from "./knowledge-graph-exception.js";

/** Thrown when a Graph Registry lookup finds no `KnowledgeGraph` for the given id. */
export class GraphNotFoundException extends KnowledgeGraphException {
  constructor(graphId: string) {
    super(`Graph not found: ${graphId}`, { code: "GRAPH_NOT_FOUND", context: { graphId } });
  }
}
