import { KnowledgeGeneratorException } from "./knowledge-generator-exception.js";

/** Thrown by `KnowledgeGeneratorSession.renew()` when the Session's lease has already expired. */
export class GeneratorLeaseException extends KnowledgeGeneratorException {}
