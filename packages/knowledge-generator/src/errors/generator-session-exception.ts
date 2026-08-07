import { KnowledgeGeneratorException } from "./knowledge-generator-exception.js";

/** Thrown by `KnowledgeGeneratorSession` when an operation is attempted against a Session in an incompatible state. */
export class GeneratorSessionException extends KnowledgeGeneratorException {}
