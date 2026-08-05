import { z } from "zod";

import { knowledgeSynchronizationStateSchema } from "./knowledge-synchronization-state-schema.js";

/**
 * The persistent envelope for one live Synchronization. `id` is the Instance's stable
 * identity; `token` is the externally addressable handle every imperative operation
 * uses to look it up in `KnowledgeSynchronizationRegistry` — "Never scan synchronization
 * collections. Lookup by token." mirroring `@aos/knowledge-retrieval`'s
 * `KnowledgeRetrievalInstance`.
 */
export const knowledgeSynchronizationInstanceSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  jobId: z.string().min(1),
  providerId: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  state: knowledgeSynchronizationStateSchema,
  retryCount: z.number().int().nonnegative(),
  changeCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export type KnowledgeSynchronizationInstance = z.infer<
  typeof knowledgeSynchronizationInstanceSchema
>;
