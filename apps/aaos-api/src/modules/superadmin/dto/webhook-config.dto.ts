import { z } from "zod";

/**
 * `PUT /api/v1/superadmin/webhook-config` body (AAOS-SETTINGS-WEBHOOK-CONFIG, Part C). Every
 * field optional — omit a pair/field entirely to leave it unchanged. An explicitly-provided
 * empty string OR `null` CLEARS that override (reverts that one field to its `.env` default) —
 * a real, deliberate "un-set" affordance, not an oversight: a superadmin who mistakenly saved a
 * bad override needs a way back to the server default without redeploying.
 */
export const PutWebhookConfigBodySchema = z.object({
  whatsapp: z
    .object({
      verifyToken: z.union([z.string(), z.null()]).optional(),
      appSecret: z.union([z.string(), z.null()]).optional(),
    })
    .optional(),
  meta: z
    .object({
      verifyToken: z.union([z.string(), z.null()]).optional(),
      appSecret: z.union([z.string(), z.null()]).optional(),
    })
    .optional(),
});
export type PutWebhookConfigBodyDto = z.infer<typeof PutWebhookConfigBodySchema>;

/**
 * `GET/PUT /api/v1/superadmin/webhook-config` response. NEVER returns the real secret value once
 * set — only whether an override exists (`verifyTokenSet`/`appSecretSet`) and a masked tail
 * (`maskTail`, same helper `maskedMetaAdAccountId` already uses) so a superadmin can sanity-check
 * without seeing the full secret. When no override row exists yet, every `*Set` field is `false`
 * and no masked field is present.
 */
export interface WebhookSecretStatusDto {
  readonly verifyTokenSet: boolean;
  readonly appSecretSet: boolean;
  readonly verifyTokenMasked?: string;
  readonly appSecretMasked?: string;
}

export interface WebhookConfigResponseDto {
  readonly whatsapp: WebhookSecretStatusDto;
  readonly meta: WebhookSecretStatusDto;
}
