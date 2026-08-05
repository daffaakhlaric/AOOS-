import {
  KnowledgeSourceException,
  type KnowledgeSourceExceptionOptions,
} from "./knowledge-source-exception.js";

/** Thrown by `KnowledgeSourceStateMachine` when a transition is not present in `KNOWLEDGE_SOURCE_STATE_TRANSITIONS`. */
export class IllegalSourceTransitionException extends KnowledgeSourceException {
  constructor(message: string, options: KnowledgeSourceExceptionOptions = {}) {
    super(message, options);
  }
}
