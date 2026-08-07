import { z } from "zod";

/**
 * "EmbeddingContext" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Public API") — the
 * caller-scoped execution context every Embedding Operation runs under.
 */
export const embeddingContextSchema = z.object({
  token: z.string().min(1),
  embeddingId: z.string().min(1),
  tenantId: z.string().min(1),
  organizationId: z.string().optional(),
  workspaceId: z.string().optional(),
  departmentId: z.string().optional(),
  environment: z.string().optional(),
  namespace: z.string().optional(),
  metadata: z.record(z.unknown()),
  traceId: z.string().optional(),
  correlationId: z.string().min(1),
});

export type EmbeddingContext = z.infer<typeof embeddingContextSchema>;
