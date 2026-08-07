import { z } from "zod";

/**
 * "KnowledgeQualityAssessmentJob" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Domain
 * Model") — the schedulable unit of work tracking one Assessment's queueing metadata.
 * Registered in the JOB Registry bucket keyed by `jobId`.
 */
export const knowledgeAssessmentJobSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  assessmentId: z.string().min(1),
  tenantId: z.string().min(1),
  priority: z.number().int().min(0).max(9).default(5),
  scheduledAt: z.string().datetime().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  failedAt: z.string().datetime().optional(),
  failureReason: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeQualityAssessmentJob = z.infer<typeof knowledgeAssessmentJobSchema>;
