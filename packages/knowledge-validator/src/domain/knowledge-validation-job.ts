import { z } from "zod";

/**
 * "KnowledgeValidationJob" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Domain
 * Model") — the schedulable unit of work tracking one Validation's queueing metadata.
 * Not a Registry bucket (the spec's 8 buckets do not include JOB); tracked via a
 * dedicated ledger on `KnowledgeValidatorManager` instead, matching the
 * `@aos/knowledge-quality` precedent.
 */
export const knowledgeValidationJobSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  validationId: z.string().min(1),
  tenantId: z.string().min(1),
  priority: z.number().int().min(0).max(9).default(5),
  scheduledAt: z.string().datetime().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  failedAt: z.string().datetime().optional(),
  failureReason: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeValidationJob = z.infer<typeof knowledgeValidationJobSchema>;
