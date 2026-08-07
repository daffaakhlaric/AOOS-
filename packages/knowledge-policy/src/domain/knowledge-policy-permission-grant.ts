import { z } from "zod";

/**
 * "KnowledgePolicyPermission" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Domain Model") —
 * a fine-grained permission grant scoped to a policy type and operation.
 */
export const knowledgePolicyPermissionGrantSchema = z.object({
  id: z.string().min(1),
  scope: z.object({
    tenantId: z.string().min(1),
    workspaceId: z.string().optional(),
  }),
  effect: z.enum(["allow", "deny"]),
  operation: z.string().optional(),
  policyType: z.string().optional(),
});

export type KnowledgePolicyPermissionGrant = z.infer<typeof knowledgePolicyPermissionGrantSchema>;
