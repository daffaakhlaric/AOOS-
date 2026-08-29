import type { Result } from "@aos/common";

import type { LeadConversation } from "../../domain/entities/LeadConversation.js";
import type { ConversationError } from "../../domain/errors/ConversationError.js";
import type { ConversationId } from "../../domain/value-objects/ConversationId.js";
import type { ClaraAgentService } from "../services/ClaraAgentService.js";

/** Read-only lookup of a conversation's current state (spec "GetConversationState.ts"). */
export class GetConversationState {
  constructor(private readonly claraAgentService: ClaraAgentService) {}

  execute(conversationId: ConversationId): Result<LeadConversation, ConversationError> {
    return this.claraAgentService.get(conversationId);
  }
}
