import { z } from "zod";

/**
 * "KnowledgeIndexContext" (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md — "PUBLIC API") — the
 * request-scoped context every `KnowledgeIndexPipeline` run carries, mirroring the
 * Context shape established by `@aos/knowledge-engine`/`@aos/knowledge-runtime`.
 */
export const knowledgeIndexContextSchema = z.object({
  assetId: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  departmentId: z.string().optional(),
  correlationId: z.string().min(1),
  traceId: z.string().optional(),
  environment: z.string().optional(),
  language: z.string().optional(),
  metadata: z.record(z.unknown()),
  variables: z.record(z.unknown()),
});

export type KnowledgeIndexContext = z.infer<typeof knowledgeIndexContextSchema>;
