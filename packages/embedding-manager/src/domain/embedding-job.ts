import { z } from "zod";

/**
 * "EmbeddingJob" (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md — "Domain Model") — the
 * schedulable unit of work tracking one Embedding's queueing metadata. Not a Registry
 * bucket (the spec's 8 buckets do not include JOB); tracked via a dedicated ledger on
 * `EmbeddingManagerLedger` instead, matching the `@aos/knowledge-validator` precedent.
 */
export const embeddingJobSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  embeddingId: z.string().min(1),
  tenantId: z.string().min(1),
  priority: z.number().int().min(0).max(9).default(5),
  scheduledAt: z.string().datetime().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  failedAt: z.string().datetime().optional(),
  failureReason: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type EmbeddingJob = z.infer<typeof embeddingJobSchema>;
