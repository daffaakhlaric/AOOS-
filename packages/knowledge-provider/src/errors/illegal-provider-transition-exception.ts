import {
  KnowledgeProviderException,
  type KnowledgeProviderExceptionOptions,
} from "./knowledge-provider-exception.js";

/** Thrown when `KnowledgeProviderStateMachine.transition()` is asked to move to a State not reachable from the current one. */
export class IllegalProviderTransitionException extends KnowledgeProviderException {
  constructor(message: string, options: KnowledgeProviderExceptionOptions = {}) {
    super(message, options);
  }
}
