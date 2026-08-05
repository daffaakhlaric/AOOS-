import { z } from "zod";

import { knowledgeRuntimeCacheReferenceSchema } from "./knowledge-runtime-cache-reference.js";
import { knowledgeRuntimeLeaseSchema } from "./knowledge-runtime-lease.js";
import { knowledgeRuntimeMetadataSchema } from "./knowledge-runtime-metadata.js";
import { knowledgeRuntimeStateSchema } from "./knowledge-runtime-state-schema.js";
import { knowledgeRuntimeStatisticsSchema } from "./knowledge-runtime-statistics.js";

/**
 * The persistent envelope for one live Knowledge Runtime. `id` is the Instance's stable
 * identity; `token` (`KnowledgeRuntimeToken`) is the externally addressable handle every
 * imperative operation uses to look it up in `KnowledgeRuntimeRegistry` — "Never search
 * runtime instances by scanning collections. Use token lookup."
 */
export const knowledgeRuntimeInstanceSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  knowledgeId: z.string().min(1),
  assetNamespace: z.string().optional(),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  sessionId: z.string().optional(),
  state: knowledgeRuntimeStateSchema,
  metadata: knowledgeRuntimeMetadataSchema,
  statistics: knowledgeRuntimeStatisticsSchema,
  lease: knowledgeRuntimeLeaseSchema.optional(),
  cacheRef: knowledgeRuntimeCacheReferenceSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export type KnowledgeRuntimeInstance = z.infer<typeof knowledgeRuntimeInstanceSchema>;
