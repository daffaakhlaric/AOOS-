import { KnowledgeValidatorException } from "./knowledge-validator-exception.js";

/** Thrown when a Finding Operation (`recordFinding()`) is attempted against a Validation that is not in a state that can accept Findings. */
export class ValidatorFindingException extends KnowledgeValidatorException {}
