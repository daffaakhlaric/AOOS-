import { z } from "zod";

/** `PUT /api/v1/superadmin/tenants/:id` body — every field optional (partial patch), same discipline as `UpdateSalesHumanBodySchema`. Never accepts `adminPassword`/`adminEmail` (that's a real Supabase Auth account edit, out of Phase 1 scope — Super Admin "Edit" here only covers the `tenants` row itself). */
export const UpdateTenantBodySchema = z.object({
  name: z.string().min(1).optional(),
  vertical: z.enum(["AUTOMOTIVE", "PROPERTY"]).optional(),
  status: z.enum(["TRIAL", "ACTIVE", "SUSPENDED"]).optional(),
  trialEndsAt: z.string().datetime().nullable().optional(),
  metaAccessToken: z.string().min(1).nullable().optional(),
  metaAdAccountId: z.string().min(1).nullable().optional(),
  metaApiVersion: z.string().min(1).optional(),
});

export type UpdateTenantBodyDto = z.infer<typeof UpdateTenantBodySchema>;
