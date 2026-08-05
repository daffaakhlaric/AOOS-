import { z } from "zod";

import { KnowledgeAssetType } from "./knowledge-asset-type.js";
import { KnowledgeClassification } from "./knowledge-classification.js";
import { KnowledgeLifecycleState } from "./knowledge-lifecycle-state.js";
import { knowledgeMetadataSchema, knowledgeStatisticsSchema } from "./knowledge-metadata.js";
import { knowledgeOwnerSchema, knowledgePublisherSchema } from "./knowledge-parties.js";
import { knowledgeScopeSchema } from "./knowledge-scope.js";
import { knowledgeVersionSchema } from "./knowledge-version.js";

/**
 * "Core Domain: KnowledgeAsset." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — the central
 * aggregate every other Core Domain type (Document, Relationship, Version, Policy,
 * Permission, ...) ultimately relates back to. `content` is an opaque payload bag this
 * package never interprets — no retrieval, embedding, or chunking happens here.
 */
export const knowledgeAssetSchema = z.object({
  id: z.string().min(1),
  namespace: z.string().min(1),
  assetType: z.nativeEnum(KnowledgeAssetType),
  scope: knowledgeScopeSchema,
  classification: z.nativeEnum(KnowledgeClassification),
  lifecycleState: z.nativeEnum(KnowledgeLifecycleState),
  version: knowledgeVersionSchema,
  metadata: knowledgeMetadataSchema,
  statistics: knowledgeStatisticsSchema,
  owner: knowledgeOwnerSchema,
  publisher: knowledgePublisherSchema.optional(),
  tags: z.array(z.string()),
  labels: z.array(z.string()),
  categoryId: z.string().optional(),
  sourceId: z.string().optional(),
  templateId: z.string().optional(),
  content: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KnowledgeAsset = z.infer<typeof knowledgeAssetSchema>;
