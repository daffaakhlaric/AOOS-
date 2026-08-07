import { z } from "zod";

/**
 * "KnowledgeQualityReport" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Domain Model") —
 * aggregates Findings + Score Metadata for a completed Assessment: metadata/summary
 * only, this package never renders anything. Built by `generateReport()` from whatever
 * `KnowledgeQualityFinding`/`KnowledgeQualityScoreMetadata` records have already been
 * recorded against the Assessment — it never itself evaluates quality. Registered
 * nowhere on its own (no dedicated Registry bucket); held on the
 * `KnowledgeQualityExecution` and returned via `KnowledgeQualityAssessmentRecord`.
 */
export const knowledgeQualityReportSchema = z.object({
  id: z.string().min(1),
  reportId: z.string().min(1),
  assessmentId: z.string().min(1),
  tenantId: z.string().min(1),
  findingIds: z.array(z.string().min(1)),
  scoreMetadataIds: z.array(z.string().min(1)),
  summary: z.string().optional(),
  generatedAt: z.string().datetime(),
});

export type KnowledgeQualityReport = z.infer<typeof knowledgeQualityReportSchema>;
