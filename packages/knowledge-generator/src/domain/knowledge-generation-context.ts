import { z } from "zod";

/**
 * "KnowledgeGenerationContext" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Domain
 * Model") — a registered grounding-context REFERENCE a Generation Request may point at
 * (e.g. a knowledge-engine namespace/collection identifier), never the underlying
 * retrieved content itself: "No embeddings. No vector search." Registered in the
 * CONTEXT Registry bucket keyed by `contextId`. Distinct from `KnowledgeGeneratorContext`
 * (`context/knowledge-generator-context.ts`), the caller-scoped operational context
 * every Generation Operation runs under.
 */
export const knowledgeGenerationContextSchema = z.object({
  id: z.string().min(1),
  contextId: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  namespace: z.string().optional(),
  referenceData: z.record(z.unknown()),
  createdAt: z.string().datetime(),
});

export type KnowledgeGenerationContext = z.infer<typeof knowledgeGenerationContextSchema>;
