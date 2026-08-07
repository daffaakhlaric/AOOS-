import {
  KnowledgeVersionException,
  type KnowledgeVersionExceptionOptions,
} from "./knowledge-version-exception.js";

/** Thrown by `KnowledgeVersionStateMachine` when a transition is not present in `KNOWLEDGE_VERSION_STATE_TRANSITIONS` — "Illegal transitions MUST throw validation errors." */
export class IllegalVersionTransitionException extends KnowledgeVersionException {
  constructor(message: string, options: KnowledgeVersionExceptionOptions = {}) {
    super(message, options);
  }
}
