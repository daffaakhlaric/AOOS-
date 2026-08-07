import { z } from "zod";

/**
 * "EmbeddingCache" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Domain Model") — cache
 * METADATA only (hit/miss counters and an opaque cache-key reference) — NEVER actual
 * cached vector data, which is entirely the concern of a caller-supplied
 * `IEmbeddingCacheProvider`.
 */
export const embeddingCacheSchema = z.object({
  id: z.string().min(1),
  cacheId: z.string().min(1),
  embeddingId: z.string().min(1),
  tenantId: z.string().min(1),
  cacheKeyReference: z.string().min(1),
  hitCount: z.number().int().nonnegative().default(0),
  missCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type EmbeddingCache = z.infer<typeof embeddingCacheSchema>;
