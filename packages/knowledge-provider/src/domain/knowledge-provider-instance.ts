import { z } from "zod";

import { knowledgeProviderStateSchema } from "./knowledge-provider-state-schema.js";

/**
 * The persistent envelope for one live Provider registration. `id` is the Instance's
 * stable identity; `token` is the externally addressable handle every imperative
 * operation uses to look it up in `KnowledgeProviderRegistry` — "Never scan provider
 * collections. Lookup by token." mirroring `@aos/knowledge-synchronization`'s
 * `KnowledgeSynchronizationInstance`.
 */
export const knowledgeProviderInstanceSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  providerId: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  state: knowledgeProviderStateSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  connectedAt: z.string().datetime().optional(),
  readyAt: z.string().datetime().optional(),
});

export type KnowledgeProviderInstance = z.infer<typeof knowledgeProviderInstanceSchema>;
