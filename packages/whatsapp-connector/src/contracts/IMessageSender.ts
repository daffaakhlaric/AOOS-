import type { Result } from "@aos/common";

import type { OutgoingMessage } from "../domain/entities/OutgoingMessage.js";
import type { WhatsAppApiError } from "../domain/errors/index.js";

/**
 * Port (Hexagonal Architecture) for the "send a fully-built `OutgoingMessage`" operation shared
 * by all three send use cases. The only implementation is
 * `application/services/MessageSenderService.ts`, which composes `IWhatsAppClient` +
 * `TokenBucketRateLimiter` + `ExponentialBackoffRetry`.
 */
export interface IMessageSender {
  send(
    message: OutgoingMessage,
    accessToken: string,
  ): Promise<Result<OutgoingMessage, WhatsAppApiError>>;
}
