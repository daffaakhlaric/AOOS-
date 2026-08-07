import { z } from "zod";

/**
 * "KnowledgeValidationReport" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Domain
 * Model") — aggregates Findings + Decision for a completed Validation: metadata/summary
 * only, this package never renders anything. Built by `generateReport()` from whatever
 * `KnowledgeValidationFinding`/`KnowledgeValidationDecision` records have already been
 * recorded against the Validation — it never itself validates or decides anything.
 * Registered nowhere on its own (no dedicated Registry bucket); held on the
 * `KnowledgeValidationExecution` and returned via `KnowledgeValidationRecord`.
 */
export const knowledgeValidationReportSchema = z.object({
  id: z.string().min(1),
  reportId: z.string().min(1),
  validationId: z.string().min(1),
  tenantId: z.string().min(1),
  findingIds: z.array(z.string().min(1)),
  decisionId: z.string().optional(),
  summary: z.string().optional(),
  generatedAt: z.string().datetime(),
});

export type KnowledgeValidationReport = z.infer<typeof knowledgeValidationReportSchema>;
