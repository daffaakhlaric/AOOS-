import type {
  WaInteractiveMessageInput,
  WaTemplateMessageInput,
  WaTextMessageInput,
} from "../../contracts/IWhatsAppClient.js";

const API_VERSION = "v21.0";
const BASE_URL = "https://graph.facebook.com";

export interface WaApiRequestBody {
  readonly messaging_product: "whatsapp";
  readonly recipient_type?: "individual";
  readonly to: string;
  readonly type: "text" | "template" | "interactive";
  readonly text?: { readonly preview_url: boolean; readonly body: string };
  readonly template?: {
    readonly name: string;
    readonly language: { readonly code: string };
    readonly components: ReadonlyArray<{
      readonly type: "body";
      readonly parameters: ReadonlyArray<{ readonly type: "text"; readonly text: string }>;
    }>;
  };
  readonly interactive?: {
    readonly type: "button";
    readonly body: { readonly text: string };
    readonly action: {
      readonly buttons: ReadonlyArray<{
        readonly type: "reply";
        readonly reply: { readonly id: string; readonly title: string };
      }>;
    };
  };
}

/** Builds the exact request URL + body shapes WhatsApp Cloud API v21.0 expects, per the spec's "WhatsApp Cloud API Integration" section. */
export class ApiRequestBuilder {
  static messagesUrl(phoneNumberId: string): string {
    return `${BASE_URL}/${API_VERSION}/${phoneNumberId}/messages`;
  }

  static textBody(input: WaTextMessageInput): WaApiRequestBody {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "text",
      text: { preview_url: input.previewUrl ?? false, body: input.body },
    };
  }

  static templateBody(input: WaTemplateMessageInput): WaApiRequestBody {
    return {
      messaging_product: "whatsapp",
      to: input.to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        components: [
          {
            type: "body",
            parameters: input.bodyParameters.map((text) => ({ type: "text" as const, text })),
          },
        ],
      },
    };
  }

  static interactiveBody(input: WaInteractiveMessageInput): WaApiRequestBody {
    return {
      messaging_product: "whatsapp",
      to: input.to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: input.bodyText },
        action: {
          buttons: input.buttons.map((button) => ({
            type: "reply" as const,
            reply: { id: button.id, title: button.title },
          })),
        },
      },
    };
  }
}
