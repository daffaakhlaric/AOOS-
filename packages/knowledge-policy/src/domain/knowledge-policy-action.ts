import { z } from "zod";

/**
 * "KnowledgePolicyAction" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Domain Model") —
 * one action that a policy rule triggers when its conditions are met.
 */
export const knowledgePolicyActionSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  actionType: z.string().min(1),
  parameters: z.record(z.unknown()),
  metadata: z.record(z.unknown()),
});

export type KnowledgePolicyAction = z.infer<typeof knowledgePolicyActionSchema>;
