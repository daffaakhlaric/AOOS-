import { z } from "zod";

/** `GET /api/v1/sales/stats` query — one sales human's personal stats (spec "/stats" page). */
export const GetSalesStatsQuerySchema = z.object({
  salesHumanId: z.string().min(1, "salesHumanId must not be empty"),
});

export type GetSalesStatsQueryDto = z.infer<typeof GetSalesStatsQuerySchema>;
