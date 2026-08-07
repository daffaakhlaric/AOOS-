import { KnowledgeValidatorException } from "./knowledge-validator-exception.js";

/** Thrown by the Pipeline's Policy Resolution stage (Stage 3) when a resolved `KnowledgeValidationPolicy` denies the request. */
export class ValidatorPolicyException extends KnowledgeValidatorException {}
