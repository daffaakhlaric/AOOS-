import { z } from "zod";

/**
 * `GET /api/v1/leads/:id/messages` query params — a paginated view over the same real per-message
 * thread `GET /api/v1/leads/:id` already inlines wholesale (coordinator note #5: "needed once a
 * conversation has enough messages that inlining all of them stops being reasonable"). `page`/
 * `limit` are 1-indexed/bounded coerced numbers (query strings arrive as strings); `order`
 * defaults to `"asc"` (chronological — the same order `MessageRepository.findByConversationId`
 * already returns) and `"desc"` reverses it for a "most recent first" view.
 */
export const GetMessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  order: z.union([z.literal("asc"), z.literal("desc")]).default("asc"),
});

export type GetMessagesQueryDto = z.infer<typeof GetMessagesQuerySchema>;
