import {
  KnowledgeRetrievalException,
  type KnowledgeRetrievalExceptionOptions,
} from "./knowledge-retrieval-exception.js";

/** Thrown when `KnowledgeRetrievalRegistry.register()` is called with an id already registered in that bucket. */
export class DuplicateRetrievalEntryException extends KnowledgeRetrievalException {
  constructor(message: string, options: KnowledgeRetrievalExceptionOptions = {}) {
    super(message, options);
  }
}
