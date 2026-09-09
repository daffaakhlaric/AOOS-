import { z } from "zod";

/** `GET /oauth/wa/callback` (Meta's real webhook GET handshake) query params — same shape as `WhatsAppWebhookController`'s handshake. */
export const WaWebhookVerifyQuerySchema = z.object({
  "hub.mode": z.string().optional(),
  "hub.verify_token": z.string().optional(),
  "hub.challenge": z.string().optional(),
});
export type WaWebhookVerifyQueryDto = z.infer<typeof WaWebhookVerifyQuerySchema>;

/** `POST /oauth/wa/embedded-signup` body — the token the WhatsApp Embedded Signup JS SDK hands back to the dashboard's browser session, forwarded here by an authenticated (`x-api-key`) request. */
export const EmbeddedSignupBodySchema = z.object({
  tenantId: z.string().min(1, "tenantId must not be empty"),
  token: z.string().min(1, "token must not be empty"),
  /**
   * `waba_configs.branch_id` is `NOT NULL` (`007_tenants_waba.sql`) — the Embedded Signup flow
   * itself carries no branch concept, so the caller (dashboard) supplies which branch this WABA
   * card should be attributed to, same as `CreateWabaConfigBodySchema.branchId` already requires
   * for the manual flow.
   */
  branchId: z.string().min(1, "branchId must not be empty"),
});
export type EmbeddedSignupBodyDto = z.infer<typeof EmbeddedSignupBodySchema>;

/** `POST /oauth/wa/manual` body — real credentials typed in by hand, verified against Meta before saving (mirrors `CreateWabaConfigBodySchema` but marks `config_source: 'manual'` explicitly, this sprint's own real column). */
export const SetupManualBodySchema = z.object({
  tenantId: z.string().min(1, "tenantId must not be empty"),
  branchId: z.string().min(1, "branchId must not be empty"),
  wabaId: z.string().min(1, "wabaId must not be empty"),
  phoneNumberId: z.string().min(1, "phoneNumberId must not be empty"),
  phoneNumber: z.string().min(1, "phoneNumber must not be empty"),
  accessToken: z.string().min(1, "accessToken must not be empty"),
});
export type SetupManualBodyDto = z.infer<typeof SetupManualBodySchema>;

export interface OAuthConnectResponseDto {
  readonly authorizeUrl: string;
}

export interface OAuthCallbackResponseDto {
  readonly success: boolean;
  readonly message: string;
}

export interface OAuthStatusResponseDto {
  readonly meta: {
    readonly connected: boolean;
    readonly source: "manual" | "oauth";
    readonly fbUserName?: string;
    readonly tokenExpiresAt?: string;
    readonly adAccountId?: string;
  };
  readonly whatsapp: {
    readonly connected: boolean;
    readonly configs: ReadonlyArray<{
      readonly id: string;
      readonly branchId: string;
      readonly source: "manual" | "embedded_signup";
      readonly webhookVerified: boolean;
    }>;
  };
}
