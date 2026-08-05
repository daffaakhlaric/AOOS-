import { z } from "zod";

import { KnowledgeIndexScheduleJobType } from "./knowledge-index-schedule-job-type.js";

export const knowledgeIndexScheduleJobSchema = z.object({
  id: z.string().min(1),
  type: z.nativeEnum(KnowledgeIndexScheduleJobType),
  assetId: z.string().optional(),
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  scheduledAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  reason: z.string().optional(),
});

export type KnowledgeIndexScheduleJob = z.infer<typeof knowledgeIndexScheduleJobSchema>;
