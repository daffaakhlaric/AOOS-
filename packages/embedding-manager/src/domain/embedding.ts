import { z } from "zod";

import { EmbeddingState } from "./embedding-state.js";

/**
 * "Embedding" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Domain Model") — the primary
 * entity: one embedding job/request instance envelope tracked through the 9-state
 * Lifecycle. Registered in the EMBEDDING Registry bucket keyed by `embeddingId`.
 */
export const embeddingSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  embeddingId: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  state: z.nativeEnum(EmbeddingState),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  settledAt: z.string().datetime().optional(),
});

export type Embedding = z.infer<typeof embeddingSchema>;
