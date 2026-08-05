import {
  KnowledgeRetrievalException,
  type KnowledgeRetrievalExceptionOptions,
} from "./knowledge-retrieval-exception.js";

/** Thrown when `KnowledgeRetrievalStateMachine.transition()` is asked to move to a State not reachable from the current one. */
export class IllegalRetrievalTransitionException extends KnowledgeRetrievalException {
  constructor(message: string, options: KnowledgeRetrievalExceptionOptions = {}) {
    super(message, options);
  }
}
