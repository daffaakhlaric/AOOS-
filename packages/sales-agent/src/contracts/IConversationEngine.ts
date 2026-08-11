import type { Result } from "@aos/common";
import type { InventoryUnit } from "@aos/dss-inventory-connector";

import type { LeadConversation } from "../domain/entities/LeadConversation.js";
import type { AgentError } from "../domain/errors/AgentError.js";
import type { ConversationStage } from "../domain/value-objects/ConversationStage.js";

export interface EngineDecision {
  readonly nextStage: ConversationStage;
  readonly responseText: string;
  readonly matchedUnits: ReadonlyArray<InventoryUnit>;
}

/** Port: decides what Jessy says next, given the current conversation state (already re-scored for this turn) and the latest inbound message text. Async: may query `@aos/dss-inventory-connector` when the lead asks about a unit. */
export interface IConversationEngine {
  decide(
    conversation: LeadConversation,
    messageText: string,
  ): Promise<Result<EngineDecision, AgentError>>;
}
