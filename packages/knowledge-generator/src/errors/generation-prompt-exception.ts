import { KnowledgeGeneratorException } from "./knowledge-generator-exception.js";

/** Thrown by the Pipeline's Prompt Resolution stage (Stage 3) when a declared `promptReferenceId` does not resolve. */
export class GenerationPromptException extends KnowledgeGeneratorException {}
