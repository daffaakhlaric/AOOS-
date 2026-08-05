import { z } from "zod";

import { KnowledgeAssetType } from "./knowledge-asset-type.js";
import { KnowledgeTemplateCategory } from "./knowledge-template-category.js";

/** "KNOWLEDGE TEMPLATES" (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — a reusable blueprint `KnowledgeTemplateEngine#instantiate()` builds a new `KnowledgeAsset` from. */
export const knowledgeTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.nativeEnum(KnowledgeTemplateCategory),
  assetType: z.nativeEnum(KnowledgeAssetType),
  version: z.string().min(1),
  defaultMetadata: z.record(z.unknown()).optional(),
  contentTemplate: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeTemplate = z.infer<typeof knowledgeTemplateSchema>;
