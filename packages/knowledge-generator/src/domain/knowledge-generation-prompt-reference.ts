import { z } from "zod";

/**
 * "KnowledgeGenerationPromptReference" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md —
 * "Domain Model") — a POINTER to a prompt owned by `@aos/prompt-runtime` (contracts
 * only), never the prompt text itself: "It MUST NEVER: ... create prompts." Registered
 * in the PROMPT Registry bucket keyed by `promptId`.
 */
export const knowledgeGenerationPromptReferenceSchema = z.object({
  id: z.string().min(1),
  promptId: z.string().min(1),
  promptVersion: z.string().min(1),
  namespace: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeGenerationPromptReference = z.infer<
  typeof knowledgeGenerationPromptReferenceSchema
>;
