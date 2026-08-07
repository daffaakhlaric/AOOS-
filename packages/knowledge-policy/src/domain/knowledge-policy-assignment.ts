import { z } from "zod";

/**
 * "KnowledgePolicyAssignment" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Domain Model") —
 * links a policy to a target entity. Assignments determine which entities are governed
 * by a particular policy.
 */
export const knowledgePolicyAssignmentSchema = z.object({
  id: z.string().min(1),
  policyId: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  priority: z.number().int().min(0),
  assignedBy: z.string().optional(),
  assignedAt: z.string().datetime(),
  metadata: z.record(z.unknown()),
});

export type KnowledgePolicyAssignment = z.infer<typeof knowledgePolicyAssignmentSchema>;
