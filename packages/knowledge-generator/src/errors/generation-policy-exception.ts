import { KnowledgeGeneratorException } from "./knowledge-generator-exception.js";

/** Thrown by the Pipeline's Policy Resolution stage (Stage 4) when a resolved `KnowledgeGenerationPolicy` denies the request. */
export class GenerationPolicyException extends KnowledgeGeneratorException {}
