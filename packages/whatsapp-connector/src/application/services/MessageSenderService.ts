import { err, ok, type Result } from "@aos/common";

import type {
  IWhatsAppClient,
  WaInteractiveMessageInput,
  WaTemplateMessageInput,
  WaTextMessageInput,
} from "../../contracts/IWhatsAppClient.js";
import type { OutgoingMessage } from "../../domain/entities/OutgoingMessage.js";
import {
  ApiServerError,
  RateLimitError,
  type WhatsAppApiError,
} from "../../domain/errors/index.js";
import type { PhoneNumberRateLimiterRegistry } from "../../infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";
import { OutgoingMessageMapper } from "../../mappers/OutgoingMessageMapper.js";
import type { WaSendMessageResponse } from "../../types/WhatsAppApiTypes.js";

export interface MessageSenderServiceOptions {
  readonly client: IWhatsAppClient;
  readonly rateLimiters: PhoneNumberRateLimiterRegistry;
  readonly retry: ExponentialBackoffRetry;
  readonly now?: () => Date;
}

/**
 * Composes `IWhatsAppClient` + the per-`phoneNumberId` `TokenBucketRateLimiter` +
 * `ExponentialBackoffRetry` behind the `IMessageSender` shape — the single place every send use
 * case (`SendTextMessage`/`SendTemplateMessage`/`SendInteractiveMessage`) routes through. On a
 * 429 from the WhatsApp Cloud API itself, feeds `retryAfterMs` back into the local bucket via
 * `notifyRateLimited` so subsequent local `tryConsume` calls respect Meta's own cooldown.
 */
export class MessageSenderService {
  private readonly client: IWhatsAppClient;
  private readonly rateLimiters: PhoneNumberRateLimiterRegistry;
  private readonly retry: ExponentialBackoffRetry;
  private readonly now: () => Date;

  constructor(options: MessageSenderServiceOptions) {
    this.client = options.client;
    this.rateLimiters = options.rateLimiters;
    this.retry = options.retry;
    this.now = options.now ?? (() => new Date());
  }

  async sendText(
    preliminary: OutgoingMessage,
    input: WaTextMessageInput,
  ): Promise<Result<OutgoingMessage, WhatsAppApiError>> {
    return this.dispatch(preliminary, input.phoneNumberId, () => this.client.sendText(input));
  }

  async sendTemplate(
    preliminary: OutgoingMessage,
    input: WaTemplateMessageInput,
  ): Promise<Result<OutgoingMessage, WhatsAppApiError>> {
    return this.dispatch(preliminary, input.phoneNumberId, () => this.client.sendTemplate(input));
  }

  async sendInteractive(
    preliminary: OutgoingMessage,
    input: WaInteractiveMessageInput,
  ): Promise<Result<OutgoingMessage, WhatsAppApiError>> {
    return this.dispatch(preliminary, input.phoneNumberId, () =>
      this.client.sendInteractive(input),
    );
  }

  private async dispatch(
    preliminary: OutgoingMessage,
    phoneNumberId: string,
    call: () => Promise<Result<WaSendMessageResponse, WhatsAppApiError>>,
  ): Promise<Result<OutgoingMessage, WhatsAppApiError>> {
    const bucket = this.rateLimiters.forPhoneNumberId(phoneNumberId);
    const budgetResult = bucket.tryConsume();
    if (!budgetResult.ok) {
      return budgetResult;
    }

    const result = await this.retry.execute(async () => {
      const attemptResult = await call();
      if (!attemptResult.ok && attemptResult.error instanceof RateLimitError) {
        bucket.notifyRateLimited(attemptResult.error.retryAfterMs);
      }
      return attemptResult;
    });

    if (!result.ok) {
      return result;
    }
    const confirmedResult = OutgoingMessageMapper.confirmFromResponse(
      preliminary,
      result.value,
      this.now(),
    );
    // Unreachable via the real client (its response always passed
    // `WaSendMessageResponseSchema` and therefore has at least `messages[0].id`); kept only so
    // this stays total against a hand-rolled `IWhatsAppClient` test double violating that contract.
    /* v8 ignore next 5 */
    if (!confirmedResult.ok) {
      return err(
        new ApiServerError(confirmedResult.error.message, { cause: confirmedResult.error }),
      );
    }
    return ok(confirmedResult.value);
  }
}
