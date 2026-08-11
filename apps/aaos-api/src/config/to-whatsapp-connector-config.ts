import type { Result } from "@aos/common";
import { Branch } from "@aos/meta-ads-connector";
import type { ConnectorConfigError, WhatsAppConnectorConfig } from "@aos/whatsapp-connector";
import { parseWhatsAppConnectorConfig } from "@aos/whatsapp-connector";

import type { AaosApiConfig } from "./aaos-api.config.js";

const WHATSAPP_BASE_URL = "https://graph.facebook.com";

/**
 * Translates this app's `AaosApiConfig` (flat env-var shape) into
 * `@aos/whatsapp-connector`'s own `WhatsAppConnectorConfig`, mirroring `to-connector-config.ts`'s
 * pattern for `@aos/meta-ads-connector` exactly — real Zod validation via
 * `parseWhatsAppConnectorConfig`, not an unchecked cast.
 *
 * Judgment call (mirrors `@aos/whatsapp-connector`'s own README "Branch.PONDOK_BAMBU resolution"):
 * the fourth WABA's env vars are named `WABA_ID_PONDOK_BAMBU`/`PHONE_NUMBER_ID_PONDOK_BAMBU`/
 * `PHONE_NUMBER_PONDOK_BAMBU` (exactly as the spec lists them), but its `branch` field is set to
 * `Branch.UMUM` here — the real `Branch` enum (re-exported by `@aos/whatsapp-connector` from
 * `@aos/meta-ads-connector`) has no `PONDOK_BAMBU` member.
 */
export function toWhatsAppConnectorConfig(
  config: AaosApiConfig,
): Result<WhatsAppConnectorConfig, ConnectorConfigError> {
  return parseWhatsAppConnectorConfig({
    apiVersion: "v21.0",
    baseUrl: WHATSAPP_BASE_URL,
    accessToken: config.WHATSAPP_ACCESS_TOKEN,
    webhookVerifyToken: config.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    webhookAppSecret: config.WHATSAPP_WEBHOOK_APP_SECRET,
    tenantId: config.AAOS_TENANT_ID,
    wabaAccounts: [
      {
        wabaId: config.WABA_ID_BINTARO,
        phoneNumberId: config.PHONE_NUMBER_ID_BINTARO,
        phoneNumber: config.PHONE_NUMBER_BINTARO,
        branch: Branch.BINTARO,
        displayName: "Mobix Bintaro",
      },
      {
        wabaId: config.WABA_ID_CINERE,
        phoneNumberId: config.PHONE_NUMBER_ID_CINERE,
        phoneNumber: config.PHONE_NUMBER_CINERE,
        branch: Branch.CINERE,
        displayName: "Mobix Cinere",
      },
      {
        wabaId: config.WABA_ID_PONDOK_BAMBU,
        phoneNumberId: config.PHONE_NUMBER_ID_PONDOK_BAMBU,
        phoneNumber: config.PHONE_NUMBER_PONDOK_BAMBU,
        branch: Branch.UMUM,
        displayName: "Mobix Pondok Bambu",
      },
      {
        wabaId: config.WABA_ID_BANDUNG,
        phoneNumberId: config.PHONE_NUMBER_ID_BANDUNG,
        phoneNumber: config.PHONE_NUMBER_BANDUNG,
        branch: Branch.BANDUNG,
        displayName: "Mobix Bandung",
      },
    ],
  });
}
