import { KnowledgeGeneratorException } from "./knowledge-generator-exception.js";

/** Thrown by the Pipeline's Provider Resolution stage (Stage 5) when no `IKnowledgeGenerationProvider` is registered for the requested `KnowledgeGenerationProviderType`. */
export class GenerationProviderException extends KnowledgeGeneratorException {}
