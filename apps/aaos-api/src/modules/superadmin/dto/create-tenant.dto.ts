import { z } from "zod";

/**
 * `POST /api/v1/superadmin/tenants` body (Part 1's "Buat Tenant Baru" modal). `adminPassword` is
 * required here and ONLY here — it is never persisted by this app, exactly like
 * `CreateSalesHumanBodySchema.password` (coordinator note #1): it goes straight to
 * `supabase.auth.admin.createUser`, no `bcrypt`, no local hash column, no `tenant_admins` table.
 *
 * `waba` is optional (the modal's "WhatsApp Business" fields are all-or-nothing — either every
 * sub-field is supplied to provision one real `waba_configs` row, or none are, matching the
 * modal's "opsional" labelling).
 */
export const CreateTenantBodySchema = z.object({
  name: z.string().min(1, "name must not be empty"),
  tenantId: z
    .string()
    .min(1, "tenantId must not be empty")
    .regex(/^[a-z0-9-]+$/, "tenantId must be a lowercase slug (letters, numbers, hyphens only)"),
  vertical: z.enum(["AUTOMOTIVE", "PROPERTY"]),
  adminEmail: z.string().email("adminEmail must be a valid email address"),
  adminPassword: z.string().min(8, "adminPassword must be at least 8 characters"),
  status: z.enum(["TRIAL", "ACTIVE", "SUSPENDED"]).default("TRIAL"),
  trialDays: z.number().int().positive().optional(),
  metaAccessToken: z.string().min(1).optional(),
  metaAdAccountId: z.string().min(1).optional(),
  metaApiVersion: z.string().min(1).optional(),
  waba: z
    .object({
      branchId: z.string().min(1, "branchId must not be empty"),
      phoneNumber: z.string().min(1, "phoneNumber must not be empty"),
      wabaId: z.string().min(1, "wabaId must not be empty"),
      phoneNumberId: z.string().min(1, "phoneNumberId must not be empty"),
      accessToken: z.string().min(1, "accessToken must not be empty"),
    })
    .optional(),
});

export type CreateTenantBodyDto = z.infer<typeof CreateTenantBodySchema>;
