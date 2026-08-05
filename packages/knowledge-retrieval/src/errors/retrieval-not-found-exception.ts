import {
  KnowledgeRetrievalException,
  type KnowledgeRetrievalExceptionOptions,
} from "./knowledge-retrieval-exception.js";

/** Thrown when `KnowledgeRetrievalRegistry` has no entry registered for a given id/bucket. */
export class RetrievalNotFoundException extends KnowledgeRetrievalException {
  constructor(message: string, options: KnowledgeRetrievalExceptionOptions = {}) {
    super(message, options);
  }
}
