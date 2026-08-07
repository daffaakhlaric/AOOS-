import { KnowledgeValidatorException } from "./knowledge-validator-exception.js";

/**
 * Thrown by the Pipeline's Decision Resolution stage (Stage 5) when a recorded
 * `KnowledgeValidationDecision` is not one of the 6 legal values, or when `approve()`/
 * `reject()` is called with a Decision value inconsistent with the target state (e.g.
 * approving with a "rejected" Decision value).
 */
export class ValidatorDecisionException extends KnowledgeValidatorException {}
