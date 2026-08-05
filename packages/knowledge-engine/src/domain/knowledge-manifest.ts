import { z } from "zod";

import { KnowledgeAssetType } from "./knowledge-asset-type.js";
import { KnowledgeClassification } from "./knowledge-classification.js";
import { knowledgeScopeSchema } from "./knowledge-scope.js";

/** "KnowledgeManifest" — a lightweight descriptor summarizing one `KnowledgeAsset` for `KnowledgeCatalog`/`KnowledgeRegistry` listings, without carrying the full asset payload. */
export const knowledgeManifestSchema = z.object({
  id: z.string().min(1),
  namespace: z.string().min(1),
  assetType: z.nativeEnum(KnowledgeAssetType),
  versionLabel: z.string().min(1),
  classification: z.nativeEnum(KnowledgeClassification),
  scope: knowledgeScopeSchema,
});

export type KnowledgeManifest = z.infer<typeof knowledgeManifestSchema>;
