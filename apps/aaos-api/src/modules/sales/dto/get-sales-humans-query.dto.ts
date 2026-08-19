import { z } from "zod";

/** `GET /api/v1/sales-humans` query — `branchId` optionally narrows to one branch's team (Part 1's "Sales Team (2 aktif)" card). */
export const GetSalesHumansQuerySchema = z.object({
  branchId: z.string().min(1).optional(),
});

export type GetSalesHumansQueryDto = z.infer<typeof GetSalesHumansQuerySchema>;
