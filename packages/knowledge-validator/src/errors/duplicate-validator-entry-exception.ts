import { KnowledgeValidatorException } from "./knowledge-validator-exception.js";

/** Thrown when `KnowledgeValidatorRegistry.register()` is called with an id already present in the target bucket. */
export class DuplicateValidatorEntryException extends KnowledgeValidatorException {}
