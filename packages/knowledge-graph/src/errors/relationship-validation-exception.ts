import { KnowledgeGraphException } from "./knowledge-graph-exception.js";

/** Thrown by the pipeline's Relationship Validation stage when an edge violates its type's semantics. */
export class RelationshipValidationException extends KnowledgeGraphException {
  constructor(message: string, context?: Readonly<Record<string, unknown>>) {
    super(message, { code: "RELATIONSHIP_VALIDATION_FAILED", context });
  }
}
