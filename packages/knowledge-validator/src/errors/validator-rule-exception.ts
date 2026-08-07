import { KnowledgeValidatorException } from "./knowledge-validator-exception.js";

/** Thrown by the Pipeline's Rule Resolution stage (Stage 2) when a declared Rule id does not resolve against the Rule Registry bucket. */
export class ValidatorRuleException extends KnowledgeValidatorException {}
