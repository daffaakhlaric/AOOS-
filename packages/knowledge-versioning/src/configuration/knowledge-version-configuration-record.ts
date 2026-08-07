import { z } from "zod";

/**
 * The per-version configuration record `KnowledgeVersionConfiguration` guards.
 * "Metadata only." — behavioural switches (`allowRollback`/`allowMerge`/
 * `immutablePublished`), retention/budget knobs (`retentionDays`/`maxSnapshots`/
 * `maxRevisions`), and an open `settings` bag that must never contain secret-looking
 * keys. No OAuth, no credentials, no storage endpoints.
 */
export const knowledgeVersionConfigurationRecordSchema = z.object({
  versionId: z.string().min(1),
  autoSnapshot: z.boolean(),
  immutablePublished: z.boolean(),
  allowRollback: z.boolean(),
  allowMerge: z.boolean(),
  retentionDays: z.number().int().positive().optional(),
  maxSnapshots: z.number().int().positive().optional(),
  maxRevisions: z.number().int().positive().optional(),
  settings: z.record(z.unknown()),
});

export type KnowledgeVersionConfigurationRecord = z.infer<
  typeof knowledgeVersionConfigurationRecordSchema
>;
