import { z } from "zod";

import { KnowledgeSynchronizationJobType } from "./knowledge-synchronization-job-type.js";
import { KnowledgeSynchronizationMode } from "./knowledge-synchronization-mode.js";

/**
 * "SYNCHRONIZATION JOB" (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) — the request
 * every `KnowledgeSynchronizationManager` run carries through the Pipeline. `providerId`
 * drives which registered `IKnowledgeSynchronizationProvider` `KnowledgeSynchronizationResolver`
 * resolves.
 */
export const knowledgeSynchronizationJobSchema = z.object({
  id: z.string().min(1),
  type: z.nativeEnum(KnowledgeSynchronizationJobType),
  mode: z.nativeEnum(KnowledgeSynchronizationMode),
  providerId: z.string().min(1),
  sourceId: z.string().min(1),
  tenantId: z.string().min(1),
  workspaceId: z.string().optional(),
  collection: z.string().optional(),
  namespace: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeSynchronizationJob = z.infer<typeof knowledgeSynchronizationJobSchema>;
