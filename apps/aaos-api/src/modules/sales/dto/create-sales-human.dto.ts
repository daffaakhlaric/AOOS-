import { z } from "zod";

/**
 * `POST /api/v1/sales-humans` body (Part 1's Add Sales Modal). `password` is required here and
 * ONLY here — it is never persisted by this app (coordinator note #1: it goes straight to
 * `supabase.auth.admin.createUser`, no `bcrypt`, no local hash column).
 */
export const CreateSalesHumanBodySchema = z.object({
  name: z.string().min(1, "name must not be empty"),
  email: z.string().email("email must be a valid email address"),
  password: z.string().min(8, "password must be at least 8 characters"),
  branchId: z.string().min(1, "branchId must not be empty"),
  phone: z.string().min(1).optional(),
  status: z.enum(["ON", "BUSY", "OFF"]).optional(),
  maxLeadsPerDay: z.number().int().positive().optional(),
});

export type CreateSalesHumanBodyDto = z.infer<typeof CreateSalesHumanBodySchema>;
