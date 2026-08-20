import type { Result } from "@aos/common";

import type { LeadConversation } from "../domain/entities/LeadConversation.js";
import type { PropertyListing } from "../domain/entities/PropertyListing.js";
import type { AgentError } from "../domain/errors/AgentError.js";
import type { ConversationStage } from "../domain/value-objects/ConversationStage.js";

export interface PropertyEngineDecision {
  readonly nextStage: ConversationStage;
  readonly responseText: string;
  readonly matchedListings: ReadonlyArray<PropertyListing>;
}

/** Port: decides what Jessy says next for a PROPERTY-vertical conversation — the sibling to `IConversationEngine`. */
export interface IPropertyConversationEngine {
  decide(
    conversation: LeadConversation,
    messageText: string,
  ): Promise<Result<PropertyEngineDecision, AgentError>>;
}
