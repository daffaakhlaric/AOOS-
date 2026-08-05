import { z } from "zod";

/** A pointer into an external cache — pure data. This package never caches anything itself; a future `IKnowledgeRuntimeCache` implementation is what actually reads/writes at `cacheKey`. */
export const knowledgeRuntimeCacheReferenceSchema = z.object({
  cacheKey: z.string().min(1),
  provider: z.string().optional(),
  cachedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});

export type KnowledgeRuntimeCacheReference = z.infer<typeof knowledgeRuntimeCacheReferenceSchema>;
