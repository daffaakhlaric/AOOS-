import { z } from "zod";

/**
 * `GET /api/v1/campaign-health/:campaignId/history` query params — `limit` is a coerced number
 * (query strings arrive as strings), defaulting to a real sensible page size and capped at a real
 * sane maximum so this never lets an unbounded value straight through to
 * `CampaignAssessmentRepository.listHistory`. Same `z.coerce.number().int().min(1).max(...).default(...)`
 * shape `GetMessagesQuerySchema` already establishes for this app's other paginated `limit` params.
 */
export const CampaignAssessmentHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CampaignAssessmentHistoryQueryDto = z.infer<
  typeof CampaignAssessmentHistoryQuerySchema
>;
