import { z } from "zod";

import { knowledgeChunkReferenceSchema } from "./knowledge-chunk-reference.js";
import { knowledgeEmbeddingReferenceSchema } from "./knowledge-embedding-reference.js";
import { KnowledgeIndexType } from "./knowledge-index-type.js";
import { knowledgeIndexVersionSchema } from "./knowledge-index-version.js";

/**
 * The persistent envelope for one indexed entry — "Knowledge Asset → Validator → Chunk
 * Reference → Metadata → Policy → Permission → Namespace → Index Builder → Index
 * Registry" (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md — "RUNTIME FLOW"). One
 * `KnowledgeAsset` produces one `KnowledgeIndexEntry` per applicable `KnowledgeIndexType`.
 */
export const knowledgeIndexEntrySchema = z.object({
  id: z.string().min(1),
  indexType: z.nativeEnum(KnowledgeIndexType),
  assetId: z.string().min(1),
  namespace: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  departmentId: z.string().optional(),
  key: z.string().min(1),
  value: z.record(z.unknown()),
  version: knowledgeIndexVersionSchema,
  chunkRefs: z.array(knowledgeChunkReferenceSchema),
  embeddingRef: knowledgeEmbeddingReferenceSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KnowledgeIndexEntry = z.infer<typeof knowledgeIndexEntrySchema>;
