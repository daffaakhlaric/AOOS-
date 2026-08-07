import { KnowledgeGeneratorException } from "./knowledge-generator-exception.js";

/** Thrown when a Registry `require()`/Manager lookup finds no entry for the given id/token. */
export class GeneratorNotFoundException extends KnowledgeGeneratorException {}
