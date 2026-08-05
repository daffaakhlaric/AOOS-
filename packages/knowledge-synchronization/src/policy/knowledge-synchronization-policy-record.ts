import { z } from "zod";

import { KnowledgeSynchronizationMode } from "../domain/knowledge-synchronization-mode.js";

/** One registered Synchronization Policy — evaluated against a `KnowledgeSynchronizationJob`'s `mode` and scope by `KnowledgeSynchronizationPolicy`. */
export const knowledgeSynchronizationPolicyRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  scope: z.object({
    tenantId: z.string().min(1),
    workspaceId: z.string().optional(),
  }),
  enabled: z.boolean(),
  allowedModes: z.array(z.nativeEnum(KnowledgeSynchronizationMode)).optional(),
  deniedModes: z.array(z.nativeEnum(KnowledgeSynchronizationMode)).optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeSynchronizationPolicyRecord = z.infer<
  typeof knowledgeSynchronizationPolicyRecordSchema
>;

export interface KnowledgeSynchronizationPolicyViolation {
  readonly policyId: string;
  readonly reason: string;
}
