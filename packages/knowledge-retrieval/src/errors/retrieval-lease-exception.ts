import {
  KnowledgeRetrievalException,
  type KnowledgeRetrievalExceptionOptions,
} from "./knowledge-retrieval-exception.js";

/** Thrown by `KnowledgeQuerySession` when a Lease cannot be renewed (already expired). */
export class RetrievalLeaseException extends KnowledgeRetrievalException {
  constructor(message: string, options: KnowledgeRetrievalExceptionOptions = {}) {
    super(message, options);
  }
}
