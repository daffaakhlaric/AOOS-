import { z } from "zod";

import { knowledgeVersionStateSchema } from "./knowledge-version-state-schema.js";

/**
 * The persistent envelope for one live Version registration. `id` is the Instance's
 * stable identity; `token` is the externally addressable `KnowledgeVersionToken` every
 * imperative operation uses to look it up — "Implement token-based registries. Never
 * scan collections."
 */
export const knowledgeVersionInstanceSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  versionId: z.string().min(1),
  assetId: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  state: knowledgeVersionStateSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().optional(),
  destroyedAt: z.string().datetime().optional(),
});

export type KnowledgeVersionInstance = z.infer<typeof knowledgeVersionInstanceSchema>;
