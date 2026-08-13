// Factory
export { CapiConnectorFactory } from "./factories/CapiConnectorFactory.js";
export type {
  CapiConnector,
  CapiConnectorFactoryOptions,
} from "./factories/CapiConnectorFactory.js";

// Use Cases
export { SendContactEvent } from "./application/use-cases/SendContactEvent.js";
export type { SendContactEventInput } from "./application/use-cases/SendContactEvent.js";
export { SendInitiateCheckoutEvent } from "./application/use-cases/SendInitiateCheckoutEvent.js";
export type { SendInitiateCheckoutEventInput } from "./application/use-cases/SendInitiateCheckoutEvent.js";
export { SendAddToWishlistEvent } from "./application/use-cases/SendAddToWishlistEvent.js";
export type { SendAddToWishlistEventInput } from "./application/use-cases/SendAddToWishlistEvent.js";
export { SendLeadEvent } from "./application/use-cases/SendLeadEvent.js";
export type { SendLeadEventInput } from "./application/use-cases/SendLeadEvent.js";
export { SendPurchaseEvent } from "./application/use-cases/SendPurchaseEvent.js";
export type { SendPurchaseEventInput } from "./application/use-cases/SendPurchaseEvent.js";
export { SendBatch } from "./application/use-cases/SendBatch.js";
export { GetEmqScore } from "./application/use-cases/GetEmqScore.js";
export type { GetEmqScoreInput } from "./application/use-cases/GetEmqScore.js";

// Services
export { CapiEventService } from "./application/services/CapiEventService.js";
export type {
  SendEventInput,
  SendLeadInput,
  SendPurchaseInput,
} from "./application/services/CapiEventService.js";
export { EventListenerService } from "./application/services/EventListenerService.js";
export {
  EventHasherService,
  hashPhone,
  hashName,
  hashCountry,
} from "./application/services/EventHasherService.js";
export { EventBatcherService } from "./application/services/EventBatcherService.js";

// Mappers
export { LeadToCapiEventMapper } from "./mappers/LeadToCapiEventMapper.js";
export type { LeadEventMapperInput } from "./mappers/LeadToCapiEventMapper.js";
export { ClosingToCapiEventMapper } from "./mappers/ClosingToCapiEventMapper.js";
export type {
  ClosingLeadEventMapperInput,
  ClosingPurchaseEventMapperInput,
} from "./mappers/ClosingToCapiEventMapper.js";

// Infrastructure
export { MetaCapiClient } from "./infrastructure/meta-api/MetaCapiClient.js";
export { CapiRequestBuilder } from "./infrastructure/meta-api/CapiRequestBuilder.js";
export { CapiResponseMapper } from "./infrastructure/meta-api/CapiResponseMapper.js";
export {
  ExponentialBackoffRetry,
  isRetryable,
} from "./infrastructure/retry/ExponentialBackoffRetry.js";

// Domain — Entities
export type {
  CapiEvent,
  CapiEventProps,
  CapiEventWireFormat,
  CapiBatch,
  EventResult,
  EmqReport,
} from "./domain/entities/index.js";
export { MAX_BATCH_SIZE } from "./domain/entities/index.js";

// Domain — Value Objects
export { EventName } from "./domain/value-objects/EventName.js";
export type { PixelId, EmqScore } from "./domain/value-objects/index.js";
export {
  HashedPhone,
  HashedName,
  ActionSource,
  EventSourceUrl,
  CurrencyCode,
} from "./domain/value-objects/index.js";

// Domain — Events
export type {
  EventSent,
  EventFailed,
  BatchCompleted,
  EmqScoreReceived,
} from "./domain/events/index.js";
export { CapiConnectorEvents } from "./domain/events/index.js";

// Domain — Errors
export { CapiError, CapiApiError, HashingError, BatchError } from "./domain/errors/index.js";

// Contracts
export type { ICapiClient, SendEventsResult } from "./contracts/ICapiClient.js";
export type { IEventHasher } from "./contracts/IEventHasher.js";
export type { IEventBatcher, EventDispatchContext } from "./contracts/IEventBatcher.js";

// Config
export type {
  CapiConnectorConfig,
  CapiConnectorConfigInput,
} from "./config/CapiConnectorConfig.js";
export {
  CapiConnectorConfigSchema,
  parseCapiConnectorConfig,
  DEFAULT_CAPI_CONNECTOR_CONFIG,
} from "./config/CapiConnectorConfig.js";
