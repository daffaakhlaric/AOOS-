import { z } from "zod";

/**
 * "KnowledgePolicyCondition" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Domain Model") —
 * one condition within a policy rule. Conditions define what must be true for a rule
 * to apply.
 */
export const knowledgePolicyConditionSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  field: z.string().min(1),
  operator: z.string().min(1),
  value: z.unknown(),
  metadata: z.record(z.unknown()),
});

export type KnowledgePolicyCondition = z.infer<typeof knowledgePolicyConditionSchema>;
