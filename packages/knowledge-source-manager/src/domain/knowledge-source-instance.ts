import { z } from "zod";

import { knowledgeSourceStateSchema } from "./knowledge-source-state-schema.js";

/**
 * The persistent envelope for one live Source registration. `id` is the Instance's
 * stable identity; `token` is the externally addressable `KnowledgeSourceToken` every
 * imperative operation uses to look it up — "Never scan collections. Lookup by token."
 */
export const knowledgeSourceInstanceSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  sourceId: z.string().min(1),
  providerId: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  state: knowledgeSourceStateSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  enabledAt: z.string().datetime().optional(),
});

export type KnowledgeSourceInstance = z.infer<typeof knowledgeSourceInstanceSchema>;
