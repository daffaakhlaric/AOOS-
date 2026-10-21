import { z } from "zod";

/** `PUT /api/v1/settings/meta` body — "Meta Ads Configuration" card's [Simpan]. Every field optional (partial patch); omitting `accessToken` leaves the tenant's stored token unchanged (never overwritten with an empty string by accident). */
export const UpdateMetaSettingsBodySchema = z.object({
  pageId: z.string().regex(/^\d+$/).optional(),
  accessToken: z.string().min(1, "accessToken must not be empty").optional(),
  adAccountId: z.string().min(1, "adAccountId must not be empty").optional(),
  apiVersion: z.string().min(1, "apiVersion must not be empty").optional(),
});

export type UpdateMetaSettingsBodyDto = z.infer<typeof UpdateMetaSettingsBodySchema>;

export interface TestMetaConnectionResponseDto {
  readonly success: boolean;
  readonly message: string;
  readonly accountName?: string;
}
