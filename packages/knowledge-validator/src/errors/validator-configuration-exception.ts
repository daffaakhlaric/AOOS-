import { KnowledgeValidatorException } from "./knowledge-validator-exception.js";

/** Thrown when a `KnowledgeValidationConfiguration` record is structurally invalid or does not resolve. */
export class ValidatorConfigurationException extends KnowledgeValidatorException {}
