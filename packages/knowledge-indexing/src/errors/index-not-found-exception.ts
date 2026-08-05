import {
  KnowledgeIndexException,
  type KnowledgeIndexExceptionOptions,
} from "./knowledge-index-exception.js";

/** Thrown when `KnowledgeIndexRegistry` has no entry registered for a given id/bucket. */
export class IndexNotFoundException extends KnowledgeIndexException {
  constructor(message: string, options: KnowledgeIndexExceptionOptions = {}) {
    super(message, options);
  }
}
