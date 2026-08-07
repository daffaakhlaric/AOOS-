import { KnowledgeValidatorException } from "./knowledge-validator-exception.js";

/** Thrown by `KnowledgeValidatorSession.renew()` when the Session's lease has already expired. */
export class ValidatorLeaseException extends KnowledgeValidatorException {}
