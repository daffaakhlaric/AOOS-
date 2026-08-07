import { KnowledgeGeneratorException } from "./knowledge-generator-exception.js";

/** Thrown by the Pipeline's Context Resolution stage (Stage 2) when a declared `contextReferenceId` does not resolve. */
export class GenerationContextException extends KnowledgeGeneratorException {}
