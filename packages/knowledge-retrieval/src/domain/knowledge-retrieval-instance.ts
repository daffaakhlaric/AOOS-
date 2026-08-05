import { z } from "zod";

import { knowledgeRetrievalStateSchema } from "./knowledge-retrieval-state-schema.js";

/**
 * The persistent envelope for one live Retrieval. `id` is the Instance's stable
 * identity; `token` is the externally addressable handle every imperative operation
 * uses to look it up in `KnowledgeRetrievalRegistry` — mirroring
 * `@aos/knowledge-runtime`'s `KnowledgeRuntimeInstance`.
 */
export const knowledgeRetrievalInstanceSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  queryId: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  state: knowledgeRetrievalStateSchema,
  resultCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export type KnowledgeRetrievalInstance = z.infer<typeof knowledgeRetrievalInstanceSchema>;
