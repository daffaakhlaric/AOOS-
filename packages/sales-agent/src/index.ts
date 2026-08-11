// Factory
export { JessyAgentFactory } from "./factories/JessyAgentFactory.js";
export type {
  JessyAgent as JessyAgentComposition,
  JessyAgentFactoryOptions,
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
export { LeadTemperature } from "./domain/value-objects/LeadTemperature.js";
export { ConversationStage } from "./domain/value-objects/ConversationStage.js";
export type { LeadScore } from "./domain/value-objects/LeadScore.js";

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
} from "./domain/errors/index.js";

// Config
export type { SalesAgentConfig } from "./config/SalesAgentConfig.js";
export { parseSalesAgentConfig } from "./config/SalesAgentConfig.js";

// Knowledge
export { JESSY_KNOWLEDGE } from "./intelligence/JessyKnowledgeBase.js";
