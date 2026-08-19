import { z } from "zod";

/**
 * `PUT /api/v1/sales-humans/:id` body — every field optional, "update only what's provided" (spec
 * "Password kosong = tidak berubah"). `email`/`password` (when present) go through
 * `supabase.auth.admin.updateUserById`; every other field updates the `sales_humans` row directly
 * (coordinator note #1). Also the mechanism the CRM Profile page's self-service edit and the
 * dashboard's "Nonaktif" (`{ status: "OFF" }`) both reuse.
 */
export const UpdateSalesHumanBodySchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  branchId: z.string().min(1).optional(),
  status: z.enum(["ON", "BUSY", "OFF"]).optional(),
  maxLeadsPerDay: z.number().int().positive().optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

export type UpdateSalesHumanBodyDto = z.infer<typeof UpdateSalesHumanBodySchema>;
