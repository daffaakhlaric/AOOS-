import { KnowledgeException, type KnowledgeExceptionOptions } from "./knowledge-exception.js";

/** Thrown by `relationship/knowledge-relationship-engine.ts` for a self-referencing, dangling, or cyclical `KnowledgeRelationship`. */
export class InvalidRelationshipException extends KnowledgeException {
  constructor(message: string, options: KnowledgeExceptionOptions = {}) {
    super(message, options);
  }
}
