import type { KnowledgeGenerationPromptReference } from "../domain/knowledge-generation-prompt-reference.js";

/**
 * "IKnowledgePromptProvider" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Extension
 * Points") — interface ONLY. The seam through which a caller-supplied `@aos/prompt-runtime`
 * adapter resolves a `KnowledgeGenerationPromptReference`. This package never constructs
 * prompt text itself.
 */
export interface IKnowledgePromptProvider {
  resolvePrompt(
    promptId: string,
    promptVersion?: string,
  ): Promise<KnowledgeGenerationPromptReference | undefined>;
}
