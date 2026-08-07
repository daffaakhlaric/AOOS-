import { KnowledgeValidatorException } from "./knowledge-validator-exception.js";

/** Thrown by `KnowledgeValidatorSession` when an operation is attempted against a Session in an incompatible state. */
export class ValidatorSessionException extends KnowledgeValidatorException {}
