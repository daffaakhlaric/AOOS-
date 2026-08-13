import type { IPublisher, ISubscriptionManager } from "@aos/event-bus";
import type { GetLead, IClosingRepository } from "@aos/lead-store";
import { createLogger, type Logger } from "@aos/logger";

import { CapiEventService } from "../application/services/CapiEventService.js";
import { EventBatcherService } from "../application/services/EventBatcherService.js";
import { EventHasherService } from "../application/services/EventHasherService.js";
import { EventListenerService } from "../application/services/EventListenerService.js";
import { GetEmqScore } from "../application/use-cases/GetEmqScore.js";
import { SendAddToWishlistEvent } from "../application/use-cases/SendAddToWishlistEvent.js";
import { SendBatch } from "../application/use-cases/SendBatch.js";
import { SendContactEvent } from "../application/use-cases/SendContactEvent.js";
import { SendInitiateCheckoutEvent } from "../application/use-cases/SendInitiateCheckoutEvent.js";
import { SendLeadEvent } from "../application/use-cases/SendLeadEvent.js";
import { SendPurchaseEvent } from "../application/use-cases/SendPurchaseEvent.js";
import type { CapiConnectorConfig } from "../config/CapiConnectorConfig.js";
import type { ICapiClient } from "../contracts/ICapiClient.js";
import { CapiConnectorEvents } from "../domain/events/CapiConnectorEvents.js";
import { MetaCapiClient } from "../infrastructure/meta-api/MetaCapiClient.js";
import { ExponentialBackoffRetry } from "../infrastructure/retry/ExponentialBackoffRetry.js";
import { ClosingToCapiEventMapper } from "../mappers/ClosingToCapiEventMapper.js";
import { LeadToCapiEventMapper } from "../mappers/LeadToCapiEventMapper.js";

export interface CapiConnectorFactoryOptions {
  readonly config: CapiConnectorConfig;
  /** Real `@aos/event-bus` `IPublisher` — used for this package's own `EventSent`/`EventFailed`/`BatchCompleted`/`EmqScoreReceived` events. */
  readonly publisher: IPublisher;
  /** Real `@aos/event-bus` `ISubscriptionManager` — used by `EventListenerService` to subscribe to lead-store's domain events (coordinator note #1). Typically the same `EventBroker` instance as `publisher`. */
  readonly subscriptionManager: ISubscriptionManager;
  /** The real, already-composed `@aos/lead-store` `GetLead` use case — reused to resolve `leadPhone`/`adId` for events whose payload doesn't carry them (coordinator note #4). */
  readonly getLead: GetLead;
  /** The real `@aos/lead-store` `IClosingRepository` — reused to resolve `unitId`/`unitPrice` for `ClosingRecorded` (coordinator note #4). This package never constructs a Supabase client itself. */
  readonly closingRepository: IClosingRepository;
  /** Optional `ICapiClient` override — defaults to `MetaCapiClient` (real `fetch`-based Meta Conversions API adapter). Tests typically override this or MSW-mock the real client's HTTP calls instead. */
  readonly capiClient?: ICapiClient;
  readonly logger?: Logger;
  readonly now?: () => Date;
}

export interface CapiConnector {
  readonly sendContactEvent: SendContactEvent;
  readonly sendInitiateCheckoutEvent: SendInitiateCheckoutEvent;
  readonly sendAddToWishlistEvent: SendAddToWishlistEvent;
  readonly sendLeadEvent: SendLeadEvent;
  readonly sendPurchaseEvent: SendPurchaseEvent;
  readonly sendBatch: SendBatch;
  readonly getEmqScore: GetEmqScore;
  readonly capiEventService: CapiEventService;
  readonly eventListenerService: EventListenerService;
}

/** The composition root (Factory Pattern) — wires every service and use case. Mirrors `@aos/lead-store`'s `LeadStoreFactory` / `@aos/closing-tracker`'s `ClosingTrackerFactory`. */
export class CapiConnectorFactory {
  static create(options: CapiConnectorFactoryOptions): CapiConnector {
    const logger = options.logger ?? createLogger({ serviceName: "capi-connector" });
    const now = options.now ?? (() => new Date());

    const client = options.capiClient ?? new MetaCapiClient({ now });
    const events = new CapiConnectorEvents(options.publisher);
    const retry = new ExponentialBackoffRetry({
      maxAttempts: options.config.retryMaxAttempts,
      baseDelayMs: options.config.retryBaseDelayMs,
    });
    const batcher = new EventBatcherService(options.config, client, retry, events, now);

    const hasher = new EventHasherService();
    const leadMapper = new LeadToCapiEventMapper(hasher, options.config.eventSourceUrl);
    const closingMapper = new ClosingToCapiEventMapper(hasher, options.config.eventSourceUrl);
    const capiEventService = new CapiEventService(leadMapper, closingMapper, batcher);

    const eventListenerService = new EventListenerService(
      options.subscriptionManager,
      options.getLead,
      options.closingRepository,
      capiEventService,
      logger,
      options.config.tenantId,
    );

    const sendContactEvent = new SendContactEvent(capiEventService);
    const sendInitiateCheckoutEvent = new SendInitiateCheckoutEvent(capiEventService);
    const sendAddToWishlistEvent = new SendAddToWishlistEvent(capiEventService);
    const sendLeadEvent = new SendLeadEvent(capiEventService);
    const sendPurchaseEvent = new SendPurchaseEvent(capiEventService);
    const sendBatch = new SendBatch(batcher);
    const getEmqScore = new GetEmqScore(client, options.config, events);

    logger.info({ tenantId: options.config.tenantId }, "capi-connector: factory composed");

    return {
      sendContactEvent,
      sendInitiateCheckoutEvent,
      sendAddToWishlistEvent,
      sendLeadEvent,
      sendPurchaseEvent,
      sendBatch,
      getEmqScore,
      capiEventService,
      eventListenerService,
    };
  }
}
