import { z } from "zod";

import { KnowledgeGenerationState } from "./knowledge-generation-state.js";

/**
 * "KnowledgeGeneration" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Domain Model") —
 * the primary entity: one generation instance envelope tracked through the 10-state
 * Lifecycle. Registered in the GENERATION Registry bucket keyed by `generationId`.
 */
export const knowledgeGenerationSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  generationId: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  state: z.nativeEnum(KnowledgeGenerationState),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export type KnowledgeGeneration = z.infer<typeof knowledgeGenerationSchema>;
