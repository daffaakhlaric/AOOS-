import type { KnowledgeGenerationContext } from "../domain/knowledge-generation-context.js";

/**
 * "IKnowledgeContextProvider" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Extension
 * Points") — interface ONLY. The seam through which a caller-supplied
 * `@aos/knowledge-engine` adapter resolves a `KnowledgeGenerationContext` reference.
 * This package never performs retrieval/embeddings/vector search itself.
 */
export interface IKnowledgeContextProvider {
  resolveContext(contextId: string): Promise<KnowledgeGenerationContext | undefined>;
}
