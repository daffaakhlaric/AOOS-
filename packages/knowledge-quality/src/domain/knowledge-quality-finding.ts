import { z } from "zod";

import { KnowledgeQualityDimension } from "./knowledge-quality-dimension.js";

/** The severity of one `KnowledgeQualityFinding` — a metadata label only, never computed by this package. */
export type KnowledgeQualityFindingSeverity = "info" | "low" | "medium" | "high" | "critical";

export const KNOWLEDGE_QUALITY_FINDING_SEVERITIES: readonly KnowledgeQualityFindingSeverity[] = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
];

/**
 * "KnowledgeQualityFinding" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Domain Model") —
 * one individual issue/observation recorded during an Assessment: a Quality Dimension,
 * a severity, a caller-authored description, and an optional location reference. Never
 * computed by this package — always recorded on behalf of a caller-supplied
 * `IKnowledgeQualityProvider`. Registered in the FINDING Registry bucket keyed by
 * `findingId`.
 */
export const knowledgeQualityFindingSchema = z.object({
  id: z.string().min(1),
  findingId: z.string().min(1),
  assessmentId: z.string().min(1),
  tenantId: z.string().min(1),
  dimension: z.nativeEnum(KnowledgeQualityDimension),
  severity: z.enum(["info", "low", "medium", "high", "critical"]),
  description: z.string().min(1),
  locationReference: z.string().optional(),
  ruleId: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeQualityFinding = z.infer<typeof knowledgeQualityFindingSchema>;
