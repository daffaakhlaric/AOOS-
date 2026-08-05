import { z } from "zod";

import { knowledgeSourceScheduleDescriptorSchema } from "../scheduler/knowledge-source-schedule-descriptor.js";
import { KnowledgeSourceScheduleMode } from "../scheduler/knowledge-source-schedule-mode.js";

/**
 * "SOURCE CONFIGURATION: Metadata only. No OAuth. No Secret. No API Client. Support
 * Schedule, Namespace, Collection, Policy, Permission, Priority, Sync Mode, Enabled,
 * Auto Sync, Incremental, Versioning, Retention." (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md)
 * — the exact 12-field list from the prompt. Judgment call: "Sync Mode" reuses
 * `KnowledgeSourceScheduleMode` (Manual/Cron/Interval/One Time/Future Event) rather than
 * inventing a second, unrelated enum — the prompt does not enumerate Sync Mode's values,
 * and a Source's sync cadence is, in practice, exactly its Schedule's mode.
 */
export const knowledgeSourceConfigurationRecordSchema = z.object({
  sourceId: z.string().min(1),
  schedule: knowledgeSourceScheduleDescriptorSchema.optional(),
  namespace: z.string().optional(),
  collection: z.string().optional(),
  policy: z.string().optional(),
  permission: z.string().optional(),
  priority: z.number().int().nonnegative(),
  syncMode: z.nativeEnum(KnowledgeSourceScheduleMode),
  enabled: z.boolean(),
  autoSync: z.boolean(),
  incremental: z.boolean(),
  versioning: z.boolean(),
  retentionDays: z.number().int().positive().optional(),
});

export type KnowledgeSourceConfigurationRecord = z.infer<
  typeof knowledgeSourceConfigurationRecordSchema
>;
