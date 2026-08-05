import { z } from "zod";

import { KnowledgeSynchronizationScheduleType } from "../domain/knowledge-synchronization-schedule-type.js";

/** "SCHEDULER" (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) — one entry in `KnowledgeSynchronizationScheduler`'s in-memory job ledger. This package never performs the actual sync work a caller reacts to by calling `KnowledgeSynchronization.synchronize()`. */
export const knowledgeSynchronizationScheduleStatusSchema = z.enum([
  "pending",
  "triggered",
  "cancelled",
]);
export type KnowledgeSynchronizationScheduleStatus = z.infer<
  typeof knowledgeSynchronizationScheduleStatusSchema
>;

export const knowledgeSynchronizationScheduleEntrySchema = z.object({
  id: z.string().min(1),
  scheduleType: z.nativeEnum(KnowledgeSynchronizationScheduleType),
  jobId: z.string().min(1),
  cronExpression: z.string().optional(),
  intervalMs: z.number().int().positive().optional(),
  runAt: z.string().datetime().optional(),
  status: knowledgeSynchronizationScheduleStatusSchema,
  createdAt: z.string().datetime(),
  triggeredAt: z.string().datetime().optional(),
  cancelledAt: z.string().datetime().optional(),
});

export type KnowledgeSynchronizationScheduleEntry = z.infer<
  typeof knowledgeSynchronizationScheduleEntrySchema
>;
