import { KnowledgeGeneratorException } from "./knowledge-generator-exception.js";

/** Thrown when a `KnowledgeGenerator` facade operation cannot be completed against its current inputs. */
export class GeneratorOperationException extends KnowledgeGeneratorException {}
