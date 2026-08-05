import { z } from "zod";

/** Runtime-scoped metadata carried on a `KnowledgeRuntimeInstance` — distinct from `@aos/knowledge-engine`'s `KnowledgeMetadata`, which describes the underlying Knowledge Asset. */
export const knowledgeRuntimeMetadataSchema = z.object({
  createdBy: z.string().optional(),
  reason: z.string().optional(),
  source: z.string().optional(),
  labels: z.array(z.string()).default([]),
  custom: z.record(z.unknown()).default({}),
});

export type KnowledgeRuntimeMetadata = z.infer<typeof knowledgeRuntimeMetadataSchema>;

export const EMPTY_KNOWLEDGE_RUNTIME_METADATA: KnowledgeRuntimeMetadata = {
  labels: [],
  custom: {},
};
