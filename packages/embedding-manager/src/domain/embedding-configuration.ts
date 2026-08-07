import { z } from "zod";

/**
 * "EmbeddingConfiguration" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Domain Model") —
 * per-Embedding execution knobs (timeout, retries, batch size, provider-specific
 * extras). NOTE: there is no dedicated Configuration Registry bucket in the spec's
 * 8-bucket list (Embedding, Provider, Model, Version, Namespace, Session, Statistics,
 * Audit). Matching the documented-gap precedent from `@aos/knowledge-generator`
 * (005.7K) and the Policy precedent in `@aos/knowledge-validator`'s own Resolver,
 * Configuration records are tracked in a dedicated in-memory map on `EmbeddingResolver`
 * (`configurationsById`) instead of a Registry bucket. See
 * docs/005.7N-EMBEDDING-MANAGER-REPORT.md — "Technical Debt" for the full judgment call.
 */
export const embeddingConfigurationSchema = z.object({
  id: z.string().min(1),
  configurationId: z.string().min(1),
  embeddingId: z.string().min(1),
  tenantId: z.string().min(1),
  timeoutMs: z.number().int().positive().optional(),
  retries: z.number().int().nonnegative().optional(),
  batchSize: z.number().int().positive().optional(),
  custom: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
});

export type EmbeddingConfiguration = z.infer<typeof embeddingConfigurationSchema>;
