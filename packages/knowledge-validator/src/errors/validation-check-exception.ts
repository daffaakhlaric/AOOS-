import { KnowledgeValidatorException } from "./knowledge-validator-exception.js";

/**
 * Thrown by the Pipeline's Validation stage (Stage 1) when the 12-stage
 * `KnowledgeValidatorValidator` reports failure. Named distinctly from
 * `ValidatorOperationException` — this is specifically the 12-stage-Validator failure
 * path, mirroring `@aos/knowledge-quality`'s `AssessmentValidationException`. See
 * docs/005.7M-KNOWLEDGE-VALIDATOR-AI-REPORT.md — "Pipeline" for the triple "Validation"
 * naming distinction this exception sits inside.
 */
export class ValidationCheckException extends KnowledgeValidatorException {}
