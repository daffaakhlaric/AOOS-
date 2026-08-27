import { z } from "zod";

/** `POST /api/v1/settings/waba` body — "WhatsApp Business (WABA)" card's [+ Tambah WABA]. */
export const CreateWabaConfigBodySchema = z.object({
  branchId: z.string().min(1, "branchId must not be empty"),
  phoneNumber: z.string().min(1, "phoneNumber must not be empty"),
  wabaId: z.string().min(1, "wabaId must not be empty"),
  phoneNumberId: z.string().min(1, "phoneNumberId must not be empty"),
  accessToken: z.string().min(1, "accessToken must not be empty"),
});
export type CreateWabaConfigBodyDto = z.infer<typeof CreateWabaConfigBodySchema>;

/** `PUT /api/v1/settings/waba/:id` body — the row's [Edit]. Every field optional (partial patch), same "omit to keep unchanged" discipline as `UpdateMetaSettingsBodySchema`. */
export const UpdateWabaConfigBodySchema = z.object({
  branchId: z.string().min(1).optional(),
  phoneNumber: z.string().min(1).optional(),
  wabaId: z.string().min(1).optional(),
  phoneNumberId: z.string().min(1).optional(),
  accessToken: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
export type UpdateWabaConfigBodyDto = z.infer<typeof UpdateWabaConfigBodySchema>;

/**
 * `POST /api/v1/settings/waba/test-draft` body — tests a raw, UNSAVED phoneNumberId+accessToken
 * pair straight from `WabaConfigModal`'s Add/Edit form, before the user clicks Simpan. Distinct
 * from `/waba/:id/test` (which tests an already-saved row's OWN stored credentials) — this one
 * never reads or writes `waba_configs` at all.
 */
export const TestDraftWabaConnectionBodySchema = z.object({
  phoneNumberId: z.string().min(1, "phoneNumberId must not be empty"),
  accessToken: z.string().min(1, "accessToken must not be empty"),
});
export type TestDraftWabaConnectionBodyDto = z.infer<typeof TestDraftWabaConnectionBodySchema>;

/** Never returns the raw `access_token` — only a masked tail, matching `TenantResponseDto`'s masking discipline (a WABA token is as sensitive as a Meta token). */
export interface WabaConfigResponseDto {
  readonly id: string;
  readonly branchId: string;
  readonly phoneNumber: string;
  readonly wabaId: string;
  readonly phoneNumberId: string;
  readonly maskedAccessToken: string;
  readonly status: "ACTIVE" | "INACTIVE";
  readonly lastTestedAt?: string;
  readonly lastTestResult?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TestWabaConnectionResponseDto {
  readonly success: boolean;
  readonly message: string;
}
