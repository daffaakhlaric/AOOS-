import {
  KnowledgeIndexException,
  type KnowledgeIndexExceptionOptions,
} from "./knowledge-index-exception.js";

/** Thrown by `KnowledgeIndexPipeline`'s Validation stage when `KnowledgeIndexValidator` reports one or more issues. */
export class IndexValidationException extends KnowledgeIndexException {
  constructor(message: string, options: KnowledgeIndexExceptionOptions = {}) {
    super(message, options);
  }
}
