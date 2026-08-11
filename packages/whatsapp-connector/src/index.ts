// Factory
export { WhatsAppConnectorFactory } from "./factories/WhatsAppConnectorFactory.js";
export type {
  WhatsAppConnector,
  WhatsAppConnectorFactoryOptions,
} from "./factories/WhatsAppConnectorFactory.js";

// Use Cases
export { SendTextMessage } from "./application/use-cases/SendTextMessage.js";
export type {
  SendTextMessageInput,
  SendTextMessageError,
} from "./application/use-cases/SendTextMessage.js";
export { SendTemplateMessage } from "./application/use-cases/SendTemplateMessage.js";
export type {
  SendTemplateMessageInput,
  SendTemplateMessageError,
} from "./application/use-cases/SendTemplateMessage.js";
export { SendInteractiveMessage } from "./application/use-cases/SendInteractiveMessage.js";
export type {
  SendInteractiveMessageInput,
  SendInteractiveMessageError,
} from "./application/use-cases/SendInteractiveMessage.js";
export { ProcessIncomingWebhook } from "./application/use-cases/ProcessIncomingWebhook.js";
export type {
  ProcessIncomingWebhookInput,
  ProcessIncomingWebhookResult,
} from "./application/use-cases/ProcessIncomingWebhook.js";
export { VerifyWebhook } from "./application/use-cases/VerifyWebhook.js";
export type { VerifyWebhookInput } from "./application/use-cases/VerifyWebhook.js";
export { GetMessageStatus } from "./application/use-cases/GetMessageStatus.js";
export { GetConversation } from "./application/use-cases/GetConversation.js";

// Services
export { MessageSenderService } from "./application/services/MessageSenderService.js";
export { WebhookProcessorService } from "./application/services/WebhookProcessorService.js";
export { ConversationService } from "./application/services/ConversationService.js";

// Domain — Entities
export { WabaAccount } from "./domain/entities/WabaAccount.js";
export type { WabaAccountProps, WabaAccountStatus } from "./domain/entities/WabaAccount.js";
export { IncomingMessage } from "./domain/entities/IncomingMessage.js";
export type { IncomingMessageProps } from "./domain/entities/IncomingMessage.js";
export { OutgoingMessage } from "./domain/entities/OutgoingMessage.js";
export type { OutgoingMessageProps } from "./domain/entities/OutgoingMessage.js";
export { Conversation } from "./domain/entities/Conversation.js";
export type { ConversationProps, ConversationStatus } from "./domain/entities/Conversation.js";
export { WebhookVerification } from "./domain/entities/WebhookVerification.js";

// Domain — Value Objects
export { WabaId } from "./domain/value-objects/WabaId.js";
export { PhoneNumberId } from "./domain/value-objects/PhoneNumberId.js";
export { PhoneNumber } from "./domain/value-objects/PhoneNumber.js";
export { MessageId } from "./domain/value-objects/MessageId.js";
export { ConversationId } from "./domain/value-objects/ConversationId.js";
export { MessageBody, MAX_MESSAGE_BODY_LENGTH } from "./domain/value-objects/MessageBody.js";
export { MessageType } from "./domain/value-objects/MessageType.js";
export { MessageStatus } from "./domain/value-objects/MessageStatus.js";
export { DeliveryTimestamp } from "./domain/value-objects/DeliveryTimestamp.js";
export { Branch } from "./domain/value-objects/Branch.js";

// Domain — Events
export type {
  MessageReceived,
  MessageSent,
  MessageDelivered,
  MessageRead,
  MessageFailed,
  ConversationStarted,
  WabaRegistered,
} from "./domain/events/index.js";
export { WhatsAppConnectorEvents } from "./domain/events/WhatsAppConnectorEvents.js";

// Errors
export {
  WhatsAppConnectorError,
  WhatsAppApiError,
  ApiServerError,
  RateLimitError,
  AuthError,
  TemplateError,
  WebhookError,
  SignatureVerificationError,
  TokenVerificationError,
  PayloadParseError,
  WabaNotFoundError,
  InvalidPhoneNumberError,
  InvalidMessageBodyError,
  ConnectorConfigError,
} from "./domain/errors/index.js";

// Registry
export { WabaRegistry } from "./registry/WabaRegistry.js";

// Config
export type {
  WhatsAppConnectorConfig,
  WhatsAppConnectorConfigInput,
  WhatsAppConnectorWabaAccountConfig,
} from "./config/WhatsAppConnectorConfig.js";
export {
  WhatsAppConnectorConfigSchema,
  parseWhatsAppConnectorConfig,
} from "./config/WhatsAppConnectorConfig.js";

// Contracts
export type {
  IWhatsAppClient,
  WaTextMessageInput,
  WaTemplateMessageInput,
  WaInteractiveMessageInput,
  WaInteractiveButton,
} from "./contracts/IWhatsAppClient.js";
export type { IMessageWebhookParser } from "./contracts/IMessageWebhookParser.js";
export type { IMessageSender } from "./contracts/IMessageSender.js";
export type { IWabaRegistry } from "./contracts/IWabaRegistry.js";

// Infrastructure
export { WhatsAppCloudApiClient } from "./infrastructure/whatsapp-api/WhatsAppCloudApiClient.js";
export { ApiRequestBuilder } from "./infrastructure/whatsapp-api/ApiRequestBuilder.js";
export { ApiResponseMapper } from "./infrastructure/whatsapp-api/ApiResponseMapper.js";
export { WebhookParser } from "./infrastructure/webhook/WebhookParser.js";
export { WebhookVerifier } from "./infrastructure/webhook/WebhookVerifier.js";
export {
  TokenBucketRateLimiter,
  PhoneNumberRateLimiterRegistry,
} from "./infrastructure/rate-limiter/TokenBucketRateLimiter.js";
export {
  ExponentialBackoffRetry,
  isRetryable,
} from "./infrastructure/retry/ExponentialBackoffRetry.js";

// Builders
export { OutgoingMessageBuilder } from "./builders/OutgoingMessageBuilder.js";
export { TemplateMessageBuilder } from "./builders/TemplateMessageBuilder.js";
export { InteractiveMessageBuilder } from "./builders/InteractiveMessageBuilder.js";

// Mappers
export { IncomingMessageMapper } from "./mappers/IncomingMessageMapper.js";
export { OutgoingMessageMapper } from "./mappers/OutgoingMessageMapper.js";
export { MessageStatusMapper } from "./mappers/MessageStatusMapper.js";
export type { MappedMessageStatus } from "./mappers/MessageStatusMapper.js";

// Utils
export { normalizeToE164 } from "./utils/PhoneNumberFormatter.js";
export { detectBranch } from "./utils/BranchDetector.js";
