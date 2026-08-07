import { KnowledgeGraphException } from "./knowledge-graph-exception.js";

/** Thrown by the pipeline's Validation stage when an operation's payload is structurally malformed. */
export class GraphValidationException extends KnowledgeGraphException {
  constructor(message: string, context?: Readonly<Record<string, unknown>>) {
    super(message, { code: "GRAPH_VALIDATION_FAILED", context });
  }
}
