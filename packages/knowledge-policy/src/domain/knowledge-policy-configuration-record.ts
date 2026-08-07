import { z } from "zod";

/**
 * "KnowledgePolicyConfiguration" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Domain Model") —
 * configuration settings for a policy instance.
 */
export const knowledgePolicyConfigurationRecordSchema = z.object({
  policyId: z.string().min(1),
  maxRules: z.number().int().min(1).optional(),
  maxAssignments: z.number().int().min(1).optional(),
  enforceMode: z.enum(["strict", "permissive", "audit"]),
  allowOverride: z.boolean(),
  evaluationTimeout: z.number().int().min(0).optional(),
});

export type KnowledgePolicyConfigurationRecord = z.infer<
  typeof knowledgePolicyConfigurationRecordSchema
>;
