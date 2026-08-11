import type { Result } from "@aos/common";

import type { WebhookError } from "../domain/errors/index.js";
import type { WaWebhookPayload } from "../types/WhatsAppWebhookTypes.js";

/**
 * Port (Hexagonal Architecture) for parsing+validating a raw WhatsApp webhook request body. The
 * only implementation is `infrastructure/webhook/WebhookParser.ts`.
 */
export interface IMessageWebhookParser {
  parse(rawBody: string): Result<WaWebhookPayload, WebhookError>;
}
