import { z } from "zod";

import { KnowledgePolicyScopeType } from "./knowledge-policy-scope-type.js";

/**
 * "KnowledgePolicyScope" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Domain Model") —
 * defines the scope boundaries for a policy. A policy's scope determines which entities
 * it applies to (global, organization, workspace, project, etc.).
 */
export const knowledgePolicyScopeSchema = z.object({
  id: z.string().min(1),
  policyId: z.string().min(1),
  scopeType: z.nativeEnum(KnowledgePolicyScopeType),
  scopeId: z.string().optional(),
  metadata: z.record(z.unknown()),
});

export type KnowledgePolicyScope = z.infer<typeof knowledgePolicyScopeSchema>;
