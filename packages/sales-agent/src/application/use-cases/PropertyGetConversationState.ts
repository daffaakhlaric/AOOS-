import type { Result } from "@aos/common";

import type { LeadConversation } from "../../domain/entities/LeadConversation.js";
import type { ConversationError } from "../../domain/errors/ConversationError.js";
import type { ConversationId } from "../../domain/value-objects/ConversationId.js";
import type { PropertyClaraAgentService } from "../services/PropertyClaraAgentService.js";

/** PROPERTY-vertical sibling to `GetConversationState` — read-only lookup of a PROPERTY conversation's current state. */
export class PropertyGetConversationState {
  constructor(private readonly claraAgentService: PropertyClaraAgentService) {}

  execute(conversationId: ConversationId): Result<LeadConversation, ConversationError> {
    return this.claraAgentService.get(conversationId);
  }
}
