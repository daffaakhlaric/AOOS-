// Factory
export { JessyAgentFactory } from "./factories/JessyAgentFactory.js";
export type {
  JessyAgent as JessyAgentComposition,
  JessyAgentFactoryOptions,
  PropertyConversationEngineFactoryOptions,
  PropertyJessyAgent as PropertyJessyAgentComposition,
  PropertyJessyAgentFactoryOptions,
} from "./factories/JessyAgentFactory.js";

// Use Cases
export { ProcessIncomingMessage } from "./application/use-cases/ProcessIncomingMessage.js";
export { TriggerHandoff } from "./application/use-cases/TriggerHandoff.js";
export { ScheduleFollowUp } from "./application/use-cases/ScheduleFollowUp.js";
export { SendFollowUp } from "./application/use-cases/SendFollowUp.js";
export { GetConversationState } from "./application/use-cases/GetConversationState.js";
export { CloseConversation } from "./application/use-cases/CloseConversation.js";

// Services
export { JessyAgentService } from "./application/services/JessyAgentService.js";
export { LeadScoringService } from "./application/services/LeadScoringService.js";
export { HandoffService } from "./application/services/HandoffService.js";
export { FollowUpService } from "./application/services/FollowUpService.js";

// Domain
export type { LeadConversation } from "./domain/entities/LeadConversation.js";
export type { LeadProfile } from "./domain/entities/LeadProfile.js";
export type { HandoffPackage } from "./domain/entities/HandoffPackage.js";
export { LeadTemperature, classifyTemperature } from "./domain/value-objects/LeadTemperature.js";
export { ConversationStage } from "./domain/value-objects/ConversationStage.js";
export type { LeadScore } from "./domain/value-objects/LeadScore.js";

// AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 2 — PROPERTY_QUALIFICATION (spec Part 6), Jessy's
// PROPERTY-vertical sibling to `ScoringCriterion`/`SCORING_RULES`. See `PropertyScoreCalculator.ts`
// for the real scope of this addition (config-level, not yet wired into `ConversationEngine`).
export {
  PROPERTY_SCORING_RULES,
  PropertyScoreCalculator,
  PROPERTY_WARM_THRESHOLD,
  PROPERTY_HOT_THRESHOLD,
} from "./scoring/PropertyScoreCalculator.js";
export type { PropertyScoringRule } from "./scoring/PropertyScoreCalculator.js";
export { PropertyScoreDelta } from "./domain/value-objects/PropertyScoreDelta.js";
export type { PropertyScoringCriterion } from "./domain/value-objects/PropertyScoreDelta.js";

// AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 7 — the real PROPERTY-vertical conversation stack
// (spec section 11 point 1): siblings to `ConversationEngine`/`StageDetector`/`ResponseGenerator`/
// `InventoryQuerier`, driving `PropertyScoreCalculator`'s real 6 dimensions and querying Phase 2's
// real `listings` (via `IListingQueryService`, implemented outside this package).
export { PropertyConversationEngine } from "./conversation/PropertyConversationEngine.js";
export { PropertyStageDetector } from "./conversation/PropertyStageDetector.js";
export { PropertyResponseGenerator } from "./conversation/PropertyResponseGenerator.js";
export {
  PropertyIntentDetector,
  PropertyDetectedIntent,
  ALL_PROPERTY_DETECTED_INTENTS,
} from "./conversation/PropertyIntentDetector.js";
export { ListingQuerier } from "./intelligence/ListingQuerier.js";
export { ListingMatcher } from "./intelligence/ListingMatcher.js";
export type { PropertyListing, PropertyType } from "./domain/entities/PropertyListing.js";
export { PROPERTY_TYPES } from "./domain/entities/PropertyListing.js";
export type { IListingQueryService } from "./contracts/IListingQueryService.js";
export type { IListingQuerier, FindListingsCriteria } from "./contracts/IListingQuerier.js";
export type {
  IPropertyConversationEngine,
  PropertyEngineDecision,
} from "./contracts/IPropertyConversationEngine.js";
export type {
  IPropertyResponseGenerator,
  PropertyResponseContext,
} from "./contracts/IPropertyResponseGenerator.js";

// Events
export type {
  ConversationStarted,
  MessageProcessed,
  LeadScoreUpdated,
  LeadBecameHot,
  HandoffTriggered,
  FollowUpScheduled,
} from "./domain/events/index.js";

// Errors
export {
  AgentError,
  ConversationError,
  ScoringError,
  HandoffError,
  LlmError,
} from "./domain/errors/index.js";

// Config
export type { SalesAgentConfig } from "./config/SalesAgentConfig.js";
export { parseSalesAgentConfig } from "./config/SalesAgentConfig.js";

// Knowledge
export { JESSY_KNOWLEDGE } from "./intelligence/JessyKnowledgeBase.js";
