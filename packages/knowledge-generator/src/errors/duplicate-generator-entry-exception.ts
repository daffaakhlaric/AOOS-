import { KnowledgeGeneratorException } from "./knowledge-generator-exception.js";

/** Thrown when `KnowledgeGeneratorRegistry.register()` is called with an id already present in the target bucket. */
export class DuplicateGeneratorEntryException extends KnowledgeGeneratorException {}
