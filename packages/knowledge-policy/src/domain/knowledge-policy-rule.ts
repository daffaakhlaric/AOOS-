import { z } from "zod";

import { KnowledgePolicyRuleType } from "./knowledge-policy-rule-type.js";

/**
 * "KnowledgePolicyRule" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Domain Model") —
 * one rule within a Knowledge Policy. Rules govern what is allowed, denied, required,
 * optional, or conditional for a given policy.
 */
export const knowledgePolicyRuleSchema = z.object({
  id: z.string().min(1),
  policyId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  ruleType: z.nativeEnum(KnowledgePolicyRuleType),
  priority: z.number().int().min(0),
  conditions: z.array(z.string()),
  actions: z.array(z.string()),
  enabled: z.boolean(),
  metadata: z.record(z.unknown()),
});

export type KnowledgePolicyRule = z.infer<typeof knowledgePolicyRuleSchema>;
