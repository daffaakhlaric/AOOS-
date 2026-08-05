import { KnowledgeException, type KnowledgeExceptionOptions } from "./knowledge-exception.js";

/** Thrown by `version/knowledge-version-engine.ts` when a requested Version operation conflicts with existing History (e.g. rolling back to a non-existent Version). */
export class VersionConflictException extends KnowledgeException {
  constructor(message: string, options: KnowledgeExceptionOptions = {}) {
    super(message, options);
  }
}
