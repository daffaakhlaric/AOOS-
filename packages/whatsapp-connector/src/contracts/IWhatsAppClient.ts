import type { Result } from "@aos/common";

import type { WhatsAppApiError } from "../domain/errors/index.js";
import type { WaSendMessageResponse } from "../types/WhatsAppApiTypes.js";

export interface WaTextMessageInput {
  readonly phoneNumberId: string;
  readonly accessToken: string;
  readonly to: string;
  readonly body: string;
  readonly previewUrl?: boolean;
}

export interface WaTemplateMessageInput {
  readonly phoneNumberId: string;
  readonly accessToken: string;
  readonly to: string;
  readonly templateName: string;
  readonly languageCode: string;
  readonly bodyParameters: ReadonlyArray<string>;
}

export interface WaInteractiveButton {
  readonly id: string;
  readonly title: string;
}

export interface WaInteractiveMessageInput {
  readonly phoneNumberId: string;
  readonly accessToken: string;
  readonly to: string;
  readonly bodyText: string;
  readonly buttons: ReadonlyArray<WaInteractiveButton>;
}

/**
 * Port (Hexagonal Architecture) for the WhatsApp Cloud API. The only implementation is
 * `infrastructure/whatsapp-api/WhatsAppCloudApiClient.ts` — `fetch`-based, no axios.
 */
export interface IWhatsAppClient {
  sendText(input: WaTextMessageInput): Promise<Result<WaSendMessageResponse, WhatsAppApiError>>;
  sendTemplate(
    input: WaTemplateMessageInput,
  ): Promise<Result<WaSendMessageResponse, WhatsAppApiError>>;
  sendInteractive(
    input: WaInteractiveMessageInput,
  ): Promise<Result<WaSendMessageResponse, WhatsAppApiError>>;
}
