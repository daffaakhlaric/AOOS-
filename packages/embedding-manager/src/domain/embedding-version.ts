import { z } from "zod";

import { EmbeddingProviderType } from "./embedding-provider-type.js";

/**
 * "EmbeddingVersion" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Domain Model") —
 * versioning metadata for a given Model/Provider combination (a model version string and
 * optional compatibility notes) — never version-control for actual vector data.
 */
export const embeddingVersionSchema = z.object({
  id: z.string().min(1),
  versionId: z.string().min(1),
  modelId: z.string().min(1),
  providerType: z.nativeEnum(EmbeddingProviderType),
  tenantId: z.string().min(1),
  versionLabel: z.string().min(1),
  compatibilityNotes: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type EmbeddingVersion = z.infer<typeof embeddingVersionSchema>;
