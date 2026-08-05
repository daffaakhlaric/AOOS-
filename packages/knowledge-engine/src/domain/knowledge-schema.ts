import { z } from "zod";

import { KnowledgeAssetType } from "./knowledge-asset-type.js";

/** "Registry for Schemas" (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — a registered field-shape descriptor for one `KnowledgeAssetType`'s expected Metadata/content fields. This package interprets a `KnowledgeSchema` only structurally (field name → primitive kind) — no JSON Schema/zod compiler is embedded. */
export const knowledgeSchemaFieldKindSchema = z.enum([
  "string",
  "number",
  "boolean",
  "object",
  "array",
]);
export type KnowledgeSchemaFieldKind = z.infer<typeof knowledgeSchemaFieldKindSchema>;

export const knowledgeSchemaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  assetType: z.nativeEnum(KnowledgeAssetType),
  version: z.string().min(1),
  fields: z.record(knowledgeSchemaFieldKindSchema),
  requiredFields: z.array(z.string()),
});

export type KnowledgeSchema = z.infer<typeof knowledgeSchemaSchema>;
