import { KnowledgeGraphException } from "./knowledge-graph-exception.js";

/** Thrown by the pipeline's Authorization stage when the configured checker denies an operation. */
export class GraphAuthorizationException extends KnowledgeGraphException {
  constructor(operation: string, actor?: string) {
    super(`Actor ${actor ?? "<anonymous>"} is not authorized to perform ${operation}`, {
      code: "GRAPH_AUTHORIZATION_DENIED",
      context: { operation, actor },
    });
  }
}
