import {
  KnowledgeRuntimeException,
  type KnowledgeRuntimeExceptionOptions,
} from "./knowledge-runtime-exception.js";

/** Thrown when `KnowledgeRuntimeStateMachine.transition()` is asked to move to a State not reachable from the current one. */
export class IllegalRuntimeTransitionException extends KnowledgeRuntimeException {
  constructor(message: string, options: KnowledgeRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
