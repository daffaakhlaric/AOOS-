import { z } from "zod";

/**
 * "KnowledgeQualityConfiguration" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Domain
 * Model") — assessment-run tuning metadata handed to a caller-supplied provider through
 * the `IKnowledgeQualityProvider`/`IKnowledgeQualityScoringProvider` interfaces. This
 * package never interprets `timeoutMs`/`retries` itself — it only validates/records
 * them. Registered in the CONFIGURATION Registry bucket keyed by `configurationId`
 * (unlike `@aos/knowledge-generator` (005.7K), which never gave Configuration its own
 * Registry bucket, this package builds that bucket properly — see
 * docs/005.7L-KNOWLEDGE-QUALITY-ENGINE-REPORT.md — "Registry").
 */
export const knowledgeQualityConfigurationSchema = z.object({
  id: z.string().min(1),
  configurationId: z.string().min(1),
  assessmentId: z.string().min(1),
  tenantId: z.string().min(1),
  timeoutMs: z.number().int().positive().optional(),
  retries: z.number().int().min(0).max(10).optional(),
  maxFindings: z.number().int().positive().optional(),
  minimumSeverity: z.enum(["info", "low", "medium", "high", "critical"]).optional(),
  custom: z.record(z.unknown()),
  createdAt: z.string().datetime(),
});

export type KnowledgeQualityConfiguration = z.infer<typeof knowledgeQualityConfigurationSchema>;
