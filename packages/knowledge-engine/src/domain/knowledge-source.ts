import { z } from "zod";

/** "KnowledgeSource" — where a `KnowledgeAsset` originated. `type` is a closed set of provenance kinds this package recognizes; the actual import/sync mechanics belong to a future `IKnowledgeSynchronizer` implementation. */
export const knowledgeSourceTypeSchema = z.enum([
  "manual",
  "import",
  "generated",
  "sync",
  "api",
  "upload",
]);
export type KnowledgeSourceType = z.infer<typeof knowledgeSourceTypeSchema>;

export const knowledgeSourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: knowledgeSourceTypeSchema,
  uri: z.string().optional(),
  importedAt: z.string().datetime().optional(),
});

export type KnowledgeSource = z.infer<typeof knowledgeSourceSchema>;
