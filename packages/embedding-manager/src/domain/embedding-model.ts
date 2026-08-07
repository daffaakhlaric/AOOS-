import { z } from "zod";

import { EmbeddingModelName } from "./embedding-model-name.js";
import { EmbeddingProviderType } from "./embedding-provider-type.js";

/**
 * "EmbeddingModel" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Domain Model") — a
 * registered model record (one of the 9 `EmbeddingModelName` metadata labels), tied to a
 * `providerType`. Metadata ONLY — `dimensions` is a caller-declared label (e.g. "1536"),
 * never computed or verified against a real embedding call.
 */
export const embeddingModelSchema = z.object({
  id: z.string().min(1),
  modelId: z.string().min(1),
  name: z.nativeEnum(EmbeddingModelName),
  providerType: z.nativeEnum(EmbeddingProviderType),
  tenantId: z.string().min(1),
  dimensions: z.number().int().positive().optional(),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type EmbeddingModel = z.infer<typeof embeddingModelSchema>;
