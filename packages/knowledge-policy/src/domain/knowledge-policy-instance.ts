import { z } from "zod";

import { knowledgePolicyStateSchema } from "./knowledge-policy-state-schema.js";

/**
 * The persistent envelope for one live Policy registration. `id` is the Instance's
 * stable identity; `token` is the externally addressable `KnowledgePolicyToken` every
 * imperative operation uses to look it up — "Implement token-based registries. Never
 * scan collections."
 */
export const knowledgePolicyInstanceSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  policyId: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  state: knowledgePolicyStateSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  activatedAt: z.string().datetime().optional(),
  destroyedAt: z.string().datetime().optional(),
});

export type KnowledgePolicyInstance = z.infer<typeof knowledgePolicyInstanceSchema>;
