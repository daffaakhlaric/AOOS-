import { z } from "zod";

import { KnowledgeChangeType } from "./knowledge-change-type.js";

/**
 * "CHANGE DETECTION ... Only metadata detection. No content parsing."
 * (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) — one detected change, sourced from
 * an `IKnowledgeSynchronizationChangeDetector`. Never carries parsed file content.
 */
export const knowledgeChangeRecordSchema = z.object({
  id: z.string().min(1),
  changeType: z.nativeEnum(KnowledgeChangeType),
  assetId: z.string().optional(),
  path: z.string().optional(),
  previousPath: z.string().optional(),
  contentHash: z.string().optional(),
  detectedAt: z.string().datetime(),
  metadata: z.record(z.unknown()),
});

export type KnowledgeChangeRecord = z.infer<typeof knowledgeChangeRecordSchema>;
