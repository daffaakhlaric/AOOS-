import { KnowledgeGeneratorException } from "./knowledge-generator-exception.js";

/** Thrown when a `KnowledgeGenerationMetadata` record fails schema parsing. */
export class InvalidGenerationMetadataException extends KnowledgeGeneratorException {}
