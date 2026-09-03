import { z } from "zod";

/**
 * `POST /api/v1/learning/trigger` body (AAOS Self-Improving, Phase SI-6 — the Learning Monitor's
 * real "Improve sekarang" manual-trigger button). Only `SAMANTHA`/`CLARA` are real, valid targets —
 * same real constraint `LearningService.onAgentRunJudged`'s own doc documents for why KAI has no
 * real learning-proposal prompt key.
 */
export const TriggerCheckBodySchema = z.object({
  agent: z.enum(["SAMANTHA", "CLARA"]),
});
export type TriggerCheckBodyDto = z.infer<typeof TriggerCheckBodySchema>;
