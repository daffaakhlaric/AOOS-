import type { IPublisher } from "@aos/event-bus";
import { createLogger, type Logger } from "@aos/logger";
import { getTracer } from "@aos/telemetry";

import { ConversationService } from "../application/services/ConversationService.js";
import { MessageSenderService } from "../application/services/MessageSenderService.js";
import { WebhookProcessorService } from "../application/services/WebhookProcessorService.js";
import type { Tracer } from "../application/tracer.js";
import { GetConversation } from "../application/use-cases/GetConversation.js";
import { GetMessageStatus } from "../application/use-cases/GetMessageStatus.js";
import { ProcessIncomingWebhook } from "../application/use-cases/ProcessIncomingWebhook.js";
import { SendInteractiveMessage } from "../application/use-cases/SendInteractiveMessage.js";
import { SendTemplateMessage } from "../application/use-cases/SendTemplateMessage.js";
import { SendTextMessage } from "../application/use-cases/SendTextMessage.js";
import { VerifyWebhook } from "../application/use-cases/VerifyWebhook.js";
import type { WhatsAppConnectorConfig } from "../config/WhatsAppConnectorConfig.js";
import { WabaAccount } from "../domain/entities/WabaAccount.js";
import { WhatsAppConnectorEvents } from "../domain/events/WhatsAppConnectorEvents.js";
import { PhoneNumber } from "../domain/value-objects/PhoneNumber.js";
import { PhoneNumberId } from "../domain/value-objects/PhoneNumberId.js";
import { WabaId } from "../domain/value-objects/WabaId.js";
import { PhoneNumberRateLimiterRegistry } from "../infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../infrastructure/retry/ExponentialBackoffRetry.js";
import { WebhookParser } from "../infrastructure/webhook/WebhookParser.js";
import { WebhookVerifier } from "../infrastructure/webhook/WebhookVerifier.js";
import { WhatsAppCloudApiClient } from "../infrastructure/whatsapp-api/WhatsAppCloudApiClient.js";
import { WabaRegistry } from "../registry/WabaRegistry.js";

export interface WhatsAppConnectorFactoryOptions {
  readonly config: WhatsAppConnectorConfig;
  /** Real `@aos/event-bus` `IPublisher` — always caller-supplied, the same composition-boundary discipline `@aos/meta-ads-connector`'s factory establishes. */
  readonly publisher: IPublisher;
  readonly logger?: Logger;
  readonly tracer?: Tracer;
  /** Injectable clock, threaded through `ProcessIncomingWebhook` and `MessageSenderService` — defaults to the real wall clock only here. */
  readonly now?: () => Date;
  /** Injectable `fetch`, forwarded to `WhatsAppCloudApiClient` — primarily for tests. */
  readonly fetchImpl?: typeof fetch;
}

export interface WhatsAppConnector {
  readonly sendTextMessage: SendTextMessage;
  readonly sendTemplateMessage: SendTemplateMessage;
  readonly sendInteractiveMessage: SendInteractiveMessage;
  readonly processIncomingWebhook: ProcessIncomingWebhook;
  readonly verifyWebhook: VerifyWebhook;
  readonly getMessageStatus: GetMessageStatus;
  readonly getConversation: GetConversation;
  readonly registry: WabaRegistry;
  readonly conversationService: ConversationService;
  readonly webhookVerifier: WebhookVerifier;
}

/**
 * The composition root (Factory Pattern) — wires every real `@aos/*` integration and every
 * infrastructure adapter into the seven use cases + three composition-level services this
 * package's public API exposes. Also registers every configured `wabaAccounts[]` entry into a
 * fresh `WabaRegistry` and emits `WabaRegistered` for each, per the spec's events list.
 */
export class WhatsAppConnectorFactory {
  static create(options: WhatsAppConnectorFactoryOptions): WhatsAppConnector {
    const logger = options.logger ?? createLogger({ serviceName: "whatsapp-connector" });
    const tracer: Tracer = options.tracer ?? getTracer("whatsapp-connector");
    const now = options.now ?? (() => new Date());

    const client = new WhatsAppCloudApiClient({
      timeoutMs: options.config.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
    const rateLimiters = new PhoneNumberRateLimiterRegistry({
      capacity: options.config.rateLimitPerSecond,
      refillWindowMs: 1000,
    });
    const retry = new ExponentialBackoffRetry({
      maxAttempts: options.config.retryMaxAttempts,
      baseDelayMs: options.config.retryBaseDelayMs,
    });
    const registry = new WabaRegistry();
    const events = new WhatsAppConnectorEvents(options.publisher);
    const conversationService = new ConversationService();
    const webhookProcessor = new WebhookProcessorService(conversationService);
    const webhookVerifier = new WebhookVerifier();
    const webhookParser = new WebhookParser();
    const sender = new MessageSenderService({ client, rateLimiters, retry, now });

    for (const account of options.config.wabaAccounts) {
      const wabaIdResult = WabaId.create(account.wabaId);
      const phoneNumberIdResult = PhoneNumberId.create(account.phoneNumberId);
      const phoneNumberResult = PhoneNumber.create(account.phoneNumber);
      // Unreachable when `options.config` was produced by `parseWhatsAppConnectorConfig`
      // (already-validated non-empty strings and a `+62` E.164-shaped `phoneNumber`) — kept
      // only so this stays total against a hand-constructed config bypassing that parser.
      /* v8 ignore next 5 */
      if (!wabaIdResult.ok || !phoneNumberIdResult.ok || !phoneNumberResult.ok) {
        throw new Error(
          `WhatsAppConnectorFactory: invalid WABA account config for ${account.wabaId}`,
        );
      }
      const accountResult = WabaAccount.create({
        id: wabaIdResult.value,
        phoneNumberId: phoneNumberIdResult.value,
        phoneNumber: phoneNumberResult.value,
        branch: account.branch,
        displayName: account.displayName,
        status: "ACTIVE",
        registeredAt: now(),
      });
      // Unreachable for the same reason as above (`displayName` is always non-empty per the Zod
      // schema, `status: "ACTIVE"` is a literal).
      /* v8 ignore next 3 */
      if (!accountResult.ok) {
        throw new Error(`WhatsAppConnectorFactory: invalid WABA account for ${account.wabaId}`);
      }
      registry.register(accountResult.value);
      void events.publishWabaRegistered({
        wabaId: accountResult.value.id.toString(),
        phoneNumberId: accountResult.value.phoneNumberId.toString(),
        branch: accountResult.value.branch,
        displayName: accountResult.value.displayName,
        tenantId: options.config.tenantId,
        correlationId: `waba-registration-${accountResult.value.phoneNumberId.toString()}`,
        occurredAt: now(),
        version: "1.0",
      });
    }

    const sendTextMessage = new SendTextMessage(
      registry,
      sender,
      events,
      options.config.accessToken,
      logger,
      tracer,
    );
    const sendTemplateMessage = new SendTemplateMessage(
      registry,
      sender,
      events,
      options.config.accessToken,
      logger,
      tracer,
    );
    const sendInteractiveMessage = new SendInteractiveMessage(
      registry,
      sender,
      events,
      options.config.accessToken,
      logger,
      tracer,
    );
    const processIncomingWebhook = new ProcessIncomingWebhook(
      webhookVerifier,
      webhookParser,
      registry,
      webhookProcessor,
      events,
      logger,
      tracer,
      now,
    );
    const verifyWebhook = new VerifyWebhook(webhookVerifier);
    const getMessageStatus = new GetMessageStatus(webhookProcessor);
    const getConversation = new GetConversation(conversationService);

    return {
      sendTextMessage,
      sendTemplateMessage,
      sendInteractiveMessage,
      processIncomingWebhook,
      verifyWebhook,
      getMessageStatus,
      getConversation,
      registry,
      conversationService,
      webhookVerifier,
    };
  }
}
