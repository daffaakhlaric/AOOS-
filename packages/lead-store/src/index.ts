// Factory
export { LeadStoreFactory } from "./factories/LeadStoreFactory.js";
export type { LeadStore, LeadStoreFactoryOptions } from "./factories/LeadStoreFactory.js";

// Use Cases
export { CreateLead } from "./application/use-cases/CreateLead.js";
export type { CreateLeadInput } from "./application/use-cases/CreateLead.js";
export { UpdateLeadStatus } from "./application/use-cases/UpdateLeadStatus.js";
export type { UpdateLeadStatusInput } from "./application/use-cases/UpdateLeadStatus.js";
export { GetLead } from "./application/use-cases/GetLead.js";
export { GetLeadsByBranch } from "./application/use-cases/GetLeadsByBranch.js";
export { GetHotLeads } from "./application/use-cases/GetHotLeads.js";
export { GetLeadsBySales } from "./application/use-cases/GetLeadsBySales.js";
export { SaveMessage } from "./application/use-cases/SaveMessage.js";
export type { SaveMessageInput } from "./application/use-cases/SaveMessage.js";
export { GetConversation } from "./application/use-cases/GetConversation.js";
export { RecordScoreEvent } from "./application/use-cases/RecordScoreEvent.js";
export type { RecordScoreEventInput } from "./application/use-cases/RecordScoreEvent.js";
export { RecordAssignment } from "./application/use-cases/RecordAssignment.js";
export type { RecordAssignmentInput } from "./application/use-cases/RecordAssignment.js";
export { RecordClosing } from "./application/use-cases/RecordClosing.js";
export type { RecordClosingInput } from "./application/use-cases/RecordClosing.js";
export { SubscribeToHotLeads } from "./application/use-cases/SubscribeToHotLeads.js";
export type {
  RealtimeSubscriptionFactory,
  SubscribeToHotLeadsInput,
} from "./application/use-cases/SubscribeToHotLeads.js";
export { GetClosingStats } from "./application/use-cases/GetClosingStats.js";
export type { GetClosingStatsInput } from "./application/use-cases/GetClosingStats.js";

// Services
export { LeadService } from "./application/services/LeadService.js";
export { ConversationService } from "./application/services/ConversationService.js";
export { RealtimeService } from "./application/services/RealtimeService.js";
export { ClosingService } from "./application/services/ClosingService.js";

// Domain
export type { Lead, LeadProps, LeadQualificationFlags } from "./domain/entities/Lead.js";
export type {
  Conversation,
  ConversationProps,
  ConversationStatus,
  ExchangeMilestones,
} from "./domain/entities/Conversation.js";
export type {
  Message,
  MessageContentType,
  MessageDeliveryStatus,
  MessageDirection,
  MessageProps,
} from "./domain/entities/Message.js";
export type { Closing, ClosingProps } from "./domain/entities/Closing.js";
export type { ScoringEvent, ScoringEventProps } from "./domain/entities/ScoringEvent.js";
export type {
  Assignment,
  AssignmentProps,
  AssignmentStatus,
} from "./domain/entities/Assignment.js";
export {
  LeadStatus,
  classifyTemperature,
  isPreAssignmentStatus,
  isTemperatureStatus,
} from "./domain/value-objects/LeadStatus.js";
export type { TemperatureStatus } from "./domain/value-objects/LeadStatus.js";
export { transitionLeadStatus } from "./domain/value-objects/LeadStatusTransition.js";
export { ClosingType, parseClosingType } from "./domain/value-objects/ClosingType.js";
export { LeadSource, parseLeadSource } from "./domain/value-objects/LeadSource.js";
export { ScoreReason, parseScoreReason } from "./domain/value-objects/ScoreReason.js";
export { LeadId } from "./domain/value-objects/LeadId.js";
export { ConversationId } from "./domain/value-objects/ConversationId.js";
export { MessageId } from "./domain/value-objects/MessageId.js";
export { ClosingId } from "./domain/value-objects/ClosingId.js";
export { AssignmentId } from "./domain/value-objects/AssignmentId.js";

// Events
export type {
  LeadCreated,
  LeadStatusChanged,
  LeadAssigned,
  LeadBecameHot,
  ConversationUpdated,
  ClosingRecorded,
  ScoreUpdated,
} from "./domain/events/index.js";
export { LeadStoreEvents } from "./domain/events/LeadStoreEvents.js";

// Errors
export {
  LeadStoreError,
  LeadNotFoundError,
  ConversationNotFoundError,
  SupabaseError,
  RealtimeError,
} from "./domain/errors/index.js";

// Config
export type { LeadStoreConfig, LeadStoreConfigInput } from "./config/LeadStoreConfig.js";
export { LeadStoreConfigSchema, parseLeadStoreConfig } from "./config/LeadStoreConfig.js";

// Types
export type { ClosingStats } from "./types/LeadStoreTypes.js";

// Contracts
export type { ILeadRepository } from "./contracts/ILeadRepository.js";
export type { IConversationRepository } from "./contracts/IConversationRepository.js";
export type { IMessageRepository } from "./contracts/IMessageRepository.js";
export type { IScoringRepository } from "./contracts/IScoringRepository.js";
export type { IAssignmentRepository } from "./contracts/IAssignmentRepository.js";
export type { ClosingFilter, IClosingRepository } from "./contracts/IClosingRepository.js";
export type { IRealtimeSubscription } from "./contracts/IRealtimeSubscription.js";
export type { ISpendProvider } from "./contracts/ISpendProvider.js";

// Builders
export { LeadBuilder } from "./builders/LeadBuilder.js";
export { ClosingBuilder } from "./builders/ClosingBuilder.js";

// Infrastructure
export { LeadRepository } from "./infrastructure/supabase/LeadRepository.js";
export { ConversationRepository } from "./infrastructure/supabase/ConversationRepository.js";
export { MessageRepository } from "./infrastructure/supabase/MessageRepository.js";
export { ScoringRepository } from "./infrastructure/supabase/ScoringRepository.js";
export { AssignmentRepository } from "./infrastructure/supabase/AssignmentRepository.js";
export { ClosingRepository } from "./infrastructure/supabase/ClosingRepository.js";
export { RealtimeSubscription } from "./infrastructure/supabase/RealtimeSubscription.js";
export { createSupabaseClient } from "./infrastructure/supabase/SupabaseClient.js";
export type { SupabaseClientLike } from "./infrastructure/supabase/SupabaseTypes.js";
export { MetaAdsSpendAdapter } from "./infrastructure/adapters/MetaAdsSpendAdapter.js";

// Mappers
export { LeadMapper } from "./infrastructure/mappers/LeadMapper.js";
export type { LeadRow } from "./infrastructure/mappers/LeadMapper.js";
export { ConversationMapper } from "./infrastructure/mappers/ConversationMapper.js";
export type { ConversationRow } from "./infrastructure/mappers/ConversationMapper.js";
export { MessageMapper } from "./infrastructure/mappers/MessageMapper.js";
export type { MessageRow } from "./infrastructure/mappers/MessageMapper.js";
export { ClosingMapper } from "./infrastructure/mappers/ClosingMapper.js";
export type { ClosingRow } from "./infrastructure/mappers/ClosingMapper.js";
