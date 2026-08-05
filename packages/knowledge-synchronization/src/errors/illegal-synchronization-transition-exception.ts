import {
  KnowledgeSynchronizationException,
  type KnowledgeSynchronizationExceptionOptions,
} from "./knowledge-synchronization-exception.js";

/** Thrown when `KnowledgeSynchronizationStateMachine.transition()` is asked to move to a State not reachable from the current one. */
export class IllegalSynchronizationTransitionException extends KnowledgeSynchronizationException {
  constructor(message: string, options: KnowledgeSynchronizationExceptionOptions = {}) {
    super(message, options);
  }
}
