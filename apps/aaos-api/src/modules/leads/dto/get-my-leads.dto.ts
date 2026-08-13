import { z } from "zod";

/** `GET /api/v1/leads/my` query — leads currently assigned to one sales human (`@aos/lead-store`'s `GetLeadsBySales`). */
export const GetMyLeadsQuerySchema = z.object({
  salesHumanId: z.string().min(1, "salesHumanId must not be empty"),
});

export type GetMyLeadsQueryDto = z.infer<typeof GetMyLeadsQuerySchema>;
