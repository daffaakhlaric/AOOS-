import { z } from "zod";

/** "KnowledgeCategory" — hierarchical, may nest under a `parentCategoryId`. */
export const knowledgeCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  parentCategoryId: z.string().min(1).optional(),
});

export type KnowledgeCategory = z.infer<typeof knowledgeCategorySchema>;

/** "KnowledgeTag" — a flat, freeform label attachable to any `KnowledgeAsset`. */
export const knowledgeTagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export type KnowledgeTag = z.infer<typeof knowledgeTagSchema>;

/** "KnowledgeLabel" — a namespaced key/value label (e.g. `{key:"env", value:"prod"}`), distinct from a plain Tag. */
export const knowledgeLabelSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  value: z.string().min(1),
});

export type KnowledgeLabel = z.infer<typeof knowledgeLabelSchema>;
