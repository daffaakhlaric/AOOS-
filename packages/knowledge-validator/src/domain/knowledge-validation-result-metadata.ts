import { z } from "zod";

/**
 * "KnowledgeValidationResultMetadata" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md —
 * "Domain Model") — metadata ABOUT a validation outcome as reported by a
 * caller-supplied `IKnowledgeValidationProvider`/`IKnowledgeValidationDecisionProvider`:
 * an optional confidence value, an outcome label, when it was recorded, and which
 * provider reported it. NEVER the validated content itself — this package only records
 * what a provider reported. Registered nowhere on its own (no dedicated Registry
 * bucket); referenced by id from a `KnowledgeValidationReport`/held on the execution.
 */
export const knowledgeValidationResultMetadataSchema = z.object({
  id: z.string().min(1),
  resultId: z.string().min(1),
  validationId: z.string().min(1),
  tenantId: z.string().min(1),
  outcome: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  providerId: z.string().min(1),
  recordedAt: z.string().datetime(),
});

export type KnowledgeValidationResultMetadata = z.infer<
  typeof knowledgeValidationResultMetadataSchema
>;
