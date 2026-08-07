import { KnowledgeValidatorException } from "./knowledge-validator-exception.js";

/** Thrown when a Registry `require()`/Manager lookup finds no entry for the given id/token. */
export class ValidatorNotFoundException extends KnowledgeValidatorException {}
