import { Branch } from "@aos/meta-ads-connector";

import type {
  WhatsAppConnectorConfig,
  WhatsAppConnectorWabaAccountConfig,
} from "../../src/config/WhatsAppConnectorConfig.js";
import type { WaWebhookPayload } from "../../src/types/WhatsAppWebhookTypes.js";

export const BINTARO_PHONE_NUMBER_ID = "100000000000001";
export const CINERE_PHONE_NUMBER_ID = "100000000000002";
export const BANDUNG_PHONE_NUMBER_ID = "100000000000003";
export const PONDOK_BAMBU_PHONE_NUMBER_ID = "100000000000004";

export const WABA_ACCOUNTS_FIXTURE: ReadonlyArray<WhatsAppConnectorWabaAccountConfig> = [
  {
    wabaId: "waba-bintaro-1",
    phoneNumberId: BINTARO_PHONE_NUMBER_ID,
    phoneNumber: "+628110000001",
    branch: Branch.BINTARO,
    displayName: "Mobix Bintaro",
  },
  {
    wabaId: "waba-cinere-1",
    phoneNumberId: CINERE_PHONE_NUMBER_ID,
    phoneNumber: "+628110000002",
    branch: Branch.CINERE,
    displayName: "Mobix Cinere",
  },
  {
    wabaId: "waba-bandung-1",
    phoneNumberId: BANDUNG_PHONE_NUMBER_ID,
    phoneNumber: "+628110000003",
    branch: Branch.BANDUNG,
    displayName: "Mobix Bandung",
  },
  // Judgment call (see Branch.ts / the engineering report resolution #1): the spec's fourth WABA
  // is documented as "PONDOK_BAMBU", a nonexistent `Branch` member — resolved to `Branch.UMUM`.
  {
    wabaId: "waba-pondok-bambu-1",
    phoneNumberId: PONDOK_BAMBU_PHONE_NUMBER_ID,
    phoneNumber: "+628110000004",
    branch: Branch.UMUM,
    displayName: "Mobix Pondok Bambu",
  },
];

export function makeConfig(
  overrides: Partial<WhatsAppConnectorConfig> = {},
): WhatsAppConnectorConfig {
  return {
    apiVersion: "v21.0",
    baseUrl: "https://graph.facebook.com",
    accessToken: "test-access-token",
    webhookVerifyToken: "test-verify-token",
    webhookAppSecret: "test-app-secret",
    tenantId: "dss-motor",
    rateLimitPerSecond: 100,
    retryMaxAttempts: 3,
    retryBaseDelayMs: 1000,
    timeoutMs: 10000,
    wabaAccounts: WABA_ACCOUNTS_FIXTURE,
    ...overrides,
  };
}

export function textMessageWebhookPayload(options: {
  readonly phoneNumberId: string;
  readonly from: string;
  readonly wamid: string;
  readonly body: string;
  readonly timestampSeconds?: number;
}): WaWebhookPayload {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-entry-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: options.from,
                phone_number_id: options.phoneNumberId,
              },
              contacts: [{ profile: { name: "Budi" }, wa_id: options.from }],
              messages: [
                {
                  from: options.from,
                  id: options.wamid,
                  timestamp: String(options.timestampSeconds ?? 1_700_000_000),
                  type: "text",
                  text: { body: options.body },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

export function interactiveButtonReplyWebhookPayload(options: {
  readonly phoneNumberId: string;
  readonly from: string;
  readonly wamid: string;
  readonly buttonId: string;
  readonly buttonTitle: string;
  readonly timestampSeconds?: number;
}): WaWebhookPayload {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-entry-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: options.from,
                phone_number_id: options.phoneNumberId,
              },
              messages: [
                {
                  from: options.from,
                  id: options.wamid,
                  timestamp: String(options.timestampSeconds ?? 1_700_000_000),
                  type: "button",
                  interactive: {
                    type: "button_reply",
                    button_reply: { id: options.buttonId, title: options.buttonTitle },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

export function statusUpdateWebhookPayload(options: {
  readonly phoneNumberId: string;
  readonly recipientId: string;
  readonly wamid: string;
  readonly status: "sent" | "delivered" | "read" | "failed";
  readonly timestampSeconds?: number;
  readonly errorCode?: number;
  readonly errorTitle?: string;
}): WaWebhookPayload {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-entry-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: options.recipientId,
                phone_number_id: options.phoneNumberId,
              },
              statuses: [
                {
                  id: options.wamid,
                  status: options.status,
                  timestamp: String(options.timestampSeconds ?? 1_700_000_000),
                  recipient_id: options.recipientId,
                  errors:
                    options.errorCode !== undefined
                      ? [{ code: options.errorCode, title: options.errorTitle ?? "Failed" }]
                      : undefined,
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

export function emptyMessagesWebhookPayload(phoneNumberId: string): WaWebhookPayload {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-entry-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "+628110000001", phone_number_id: phoneNumberId },
              messages: [],
            },
          },
        ],
      },
    ],
  };
}

export function waSendMessageResponseJson(
  wamid: string,
  to = "+628123456789",
): Record<string, unknown> {
  return {
    messaging_product: "whatsapp",
    contacts: [{ input: to, wa_id: to.replace("+", "") }],
    messages: [{ id: wamid }],
  };
}

export function waErrorResponseJson(code: number, message: string): Record<string, unknown> {
  return { error: { message, code, type: "OAuthException", fbtrace_id: "trace-1" } };
}
