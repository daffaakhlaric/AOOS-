import { KnowledgeValidatorException } from "./knowledge-validator-exception.js";

/** Thrown when a `KnowledgeValidationMetadata` record fails schema parsing. */
export class InvalidValidationMetadataException extends KnowledgeValidatorException {}
