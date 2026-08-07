import { z } from "zod";

/**
 * "KnowledgeValidationConfiguration" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md —
 * "Domain Model") — validation-run tuning metadata handed to a caller-supplied provider
 * through the `IKnowledgeValidationProvider`/`IKnowledgeValidationDecisionProvider`
 * interfaces. This package never interprets `timeoutMs`/`retries` itself — it only
 * validates/records them. Registered in the CONFIGURATION Registry bucket keyed by
 * `configurationId`.
 */
export const knowledgeValidationConfigurationSchema = z.object({
  id: z.string().min(1),
  configurationId: z.string().min(1),
  validationId: z.string().min(1),
  tenantId: z.string().min(1),
  timeoutMs: z.number().int().positive().optional(),
  retries: z.number().int().min(0).max(10).optional(),
  maxFindings: z.number().int().positive().optional(),
  minimumSeverity: z.enum(["info", "low", "medium", "high", "critical"]).optional(),
  custom: z.record(z.unknown()),
  createdAt: z.string().datetime(),
});

export type KnowledgeValidationConfiguration = z.infer<
  typeof knowledgeValidationConfigurationSchema
>;
