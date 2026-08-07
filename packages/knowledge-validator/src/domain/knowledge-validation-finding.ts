import { z } from "zod";

import { KnowledgeValidationCategory } from "./knowledge-validation-category.js";

/** The severity of one `KnowledgeValidationFinding` — a metadata label only, never computed by this package. */
export type KnowledgeValidationFindingSeverity = "info" | "low" | "medium" | "high" | "critical";

export const KNOWLEDGE_VALIDATION_FINDING_SEVERITIES: readonly KnowledgeValidationFindingSeverity[] =
  ["info", "low", "medium", "high", "critical"];

/**
 * "KnowledgeValidationFinding" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Domain
 * Model") — one individual issue/observation recorded during a Validation: a Validation
 * Category, a severity, and a caller-authored description. Never computed by this
 * package — always recorded on behalf of a caller-supplied
 * `IKnowledgeValidationProvider`. Registered in the FINDING Registry bucket keyed by
 * `findingId`.
 */
export const knowledgeValidationFindingSchema = z.object({
  id: z.string().min(1),
  findingId: z.string().min(1),
  validationId: z.string().min(1),
  tenantId: z.string().min(1),
  category: z.nativeEnum(KnowledgeValidationCategory),
  severity: z.enum(["info", "low", "medium", "high", "critical"]),
  description: z.string().min(1),
  locationReference: z.string().optional(),
  ruleId: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeValidationFinding = z.infer<typeof knowledgeValidationFindingSchema>;
