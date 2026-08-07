import { KnowledgeValidatorException } from "./knowledge-validator-exception.js";

/** Thrown by `KnowledgeValidatorStateMachine.transition()` when the requested edge is not in `KNOWLEDGE_VALIDATION_STATE_TRANSITIONS`. */
export class IllegalValidationTransitionException extends KnowledgeValidatorException {}
