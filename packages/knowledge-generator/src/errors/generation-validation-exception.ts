import { KnowledgeGeneratorException } from "./knowledge-generator-exception.js";

/** Thrown by the Pipeline's Validation stage (Stage 1) when the 12-stage Validator reports failure. */
export class GenerationValidationException extends KnowledgeGeneratorException {}
