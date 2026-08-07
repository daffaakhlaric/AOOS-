import { z } from "zod";

/**
 * "EmbeddingResultMetadata" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Domain Model") —
 * metadata ABOUT a completed embedding (dimension count, provider-reported metadata,
 * timing) — NEVER the actual vector/embedding values themselves, since this package
 * never generates embeddings. `providerReportedMetadata` is an opaque bag the caller's
 * `IEmbeddingProvider` may return alongside its result (e.g. token usage, latency) — it
 * MUST NOT contain the vector.
 */
export const embeddingResultMetadataSchema = z.object({
  id: z.string().min(1),
  resultId: z.string().min(1),
  embeddingId: z.string().min(1),
  tenantId: z.string().min(1),
  dimensionCount: z.number().int().positive(),
  providerReportedMetadata: z.record(z.unknown()).optional(),
  completedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export type EmbeddingResultMetadata = z.infer<typeof embeddingResultMetadataSchema>;
