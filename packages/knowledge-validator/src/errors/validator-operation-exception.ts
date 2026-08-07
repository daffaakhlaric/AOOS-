import { KnowledgeValidatorException } from "./knowledge-validator-exception.js";

/** Thrown when a `KnowledgeValidator` facade operation cannot be completed against its current inputs. */
export class ValidatorOperationException extends KnowledgeValidatorException {}
