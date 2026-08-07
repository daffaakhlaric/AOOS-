import { z } from "zod";

import { EmbeddingProviderType } from "./embedding-provider-type.js";

/**
 * "EmbeddingProvider" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Domain Model") — a
 * registered provider-type record (one of the 8 `EmbeddingProviderType` metadata tags).
 * Metadata ONLY — this package never implements or calls a provider; registering one
 * simply makes it resolvable by the Pipeline's Provider Resolution stage.
 */
export const embeddingProviderSchema = z.object({
  id: z.string().min(1),
  providerId: z.string().min(1),
  name: z.string().min(1),
  type: z.nativeEnum(EmbeddingProviderType),
  tenantId: z.string().min(1),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type EmbeddingProvider = z.infer<typeof embeddingProviderSchema>;
