import { KnowledgeQualityException } from "./knowledge-quality-exception.js";

/** Thrown by the Pipeline's Validation stage (Stage 1) when the 12-stage Validator reports failure. */
export class AssessmentValidationException extends KnowledgeQualityException {}
