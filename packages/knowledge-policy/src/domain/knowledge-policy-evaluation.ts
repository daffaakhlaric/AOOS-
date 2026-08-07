import { z } from "zod";

/** Evaluation result for one policy against a target. */
export enum KnowledgePolicyEvaluationResult {
  PASS = "pass",
  FAIL = "fail",
  WARNING = "warning",
  SKIP = "skip",
}

/**
 * "KnowledgePolicyEvaluation" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Domain Model") —
 * the result of evaluating a single policy against a target entity.
 */
export const knowledgePolicyEvaluationSchema = z.object({
  id: z.string().min(1),
  policyId: z.string().min(1),
  targetId: z.string().min(1),
  result: z.nativeEnum(KnowledgePolicyEvaluationResult),
  violations: z.array(
    z.object({
      ruleId: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
  evaluatedAt: z.string().datetime(),
  evaluatedBy: z.string().optional(),
  metadata: z.record(z.unknown()),
});

export type KnowledgePolicyEvaluation = z.infer<typeof knowledgePolicyEvaluationSchema>;
export type KnowledgePolicyViolation = KnowledgePolicyEvaluation["violations"][number];
