import { z } from "zod";

import { KnowledgePolicyType } from "./knowledge-policy-type.js";

/**
 * "KnowledgePolicyMetadata" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Domain Model") —
 * the descriptive metadata record for one Knowledge Policy. This package owns ONLY
 * policy metadata — no asset content, no file references, no secrets.
 */
export const knowledgePolicyMetadataSchema = z.object({
  policyId: z.string().min(1),
  policyName: z.string().min(1),
  policyDescription: z.string().optional(),
  policyType: z.nativeEnum(KnowledgePolicyType),
  priority: z.number().int().min(0),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  labels: z.array(z.string()),
  tags: z.array(z.string()),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KnowledgePolicyMetadata = z.infer<typeof knowledgePolicyMetadataSchema>;
