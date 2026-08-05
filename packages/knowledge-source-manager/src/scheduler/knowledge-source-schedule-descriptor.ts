import { z } from "zod";

import { KnowledgeSourceScheduleMode } from "./knowledge-source-schedule-mode.js";

/**
 * A metadata-only Schedule descriptor. `KnowledgeSourceScheduler` validates that the
 * field a given `mode` requires is present — it never touches a real timer or cron
 * library.
 */
export const knowledgeSourceScheduleDescriptorSchema = z.object({
  mode: z.nativeEnum(KnowledgeSourceScheduleMode),
  cronExpression: z.string().min(1).optional(),
  intervalMs: z.number().int().positive().optional(),
  runAt: z.string().datetime().optional(),
  eventName: z.string().min(1).optional(),
});

export type KnowledgeSourceScheduleDescriptor = z.infer<
  typeof knowledgeSourceScheduleDescriptorSchema
>;
