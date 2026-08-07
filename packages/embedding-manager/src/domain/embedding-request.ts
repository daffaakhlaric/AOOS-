import { z } from "zod";

import { EmbeddingModelName } from "./embedding-model-name.js";
import { EmbeddingProviderType } from "./embedding-provider-type.js";

/**
 * "EmbeddingRequest" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Domain Model") — the
 * caller's declared input for one Embedding: a reference to content that lives
 * elsewhere, plus the Provider/Model/Namespace/Configuration selection. NEVER carries
 * actual text content (the "AI Scope Boundary" forbids this package from touching prompt
 * text) — only `textReference`/`contentReference` opaque pointers the caller resolves.
 */
export const embeddingRequestSchema = z.object({
  id: z.string().min(1),
  requestId: z.string().min(1),
  embeddingId: z.string().min(1),
  tenantId: z.string().min(1),
  textReference: z.string().min(1),
  contentReference: z.string().optional(),
  providerType: z.nativeEnum(EmbeddingProviderType),
  modelName: z.nativeEnum(EmbeddingModelName),
  namespaceId: z.string().optional(),
  configurationId: z.string().optional(),
  requestedBy: z.string().min(1),
  instructions: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type EmbeddingRequest = z.infer<typeof embeddingRequestSchema>;
