import {
  KnowledgeRetrievalException,
  type KnowledgeRetrievalExceptionOptions,
} from "./knowledge-retrieval-exception.js";

/** Thrown by `KnowledgePermissionResolver` — "Permission filtering happens BEFORE results are returned. Never expose unauthorized knowledge." */
export class RetrievalPermissionDeniedException extends KnowledgeRetrievalException {
  constructor(message: string, options: KnowledgeRetrievalExceptionOptions = {}) {
    super(message, options);
  }
}
