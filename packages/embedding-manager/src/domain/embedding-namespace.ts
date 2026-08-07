import { z } from "zod";

/**
 * "EmbeddingNamespace" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Domain Model") — a
 * logical partition an Embedding's results are metadata-tagged with (e.g. a tenant's
 * "docs" vs "support-tickets" collection name) — never an actual vector-index or
 * storage-backend reference; the real storage/index is entirely the caller's concern via
 * `IEmbeddingStorageProvider`.
 */
export const embeddingNamespaceSchema = z.object({
  id: z.string().min(1),
  namespaceId: z.string().min(1),
  name: z.string().min(1),
  tenantId: z.string().min(1),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type EmbeddingNamespace = z.infer<typeof embeddingNamespaceSchema>;
