import { err, ok, type Result } from "@aos/common";

import type { LeadConversation } from "../../domain/entities/LeadConversation.js";
import type { ConversationError } from "../../domain/errors/ConversationError.js";
import type { JessyAgentEvents } from "../../domain/events/JessyAgentEvents.js";
import type { ConversationId } from "../../domain/value-objects/ConversationId.js";
import type { JessyAgentService } from "../services/JessyAgentService.js";

export interface CloseConversationInput {
  readonly conversationId: ConversationId;
  readonly reason: string;
  readonly tenantId: string;
  readonly correlationId: string;
}

/** Marks a conversation `CLOSED` and publishes `ConversationClosed` (spec "CloseConversation.ts"). */
export class CloseConversation {
  constructor(
    private readonly jessyAgentService: JessyAgentService,
    private readonly events: JessyAgentEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    input: CloseConversationInput,
  ): Promise<Result<LeadConversation, ConversationError>> {
    const closedResult = this.jessyAgentService.close(input.conversationId);
    if (!closedResult.ok) {
      return err(closedResult.error);
    }
    await this.events.publishConversationClosed({
      conversationId: closedResult.value.id.toString(),
      leadPhone: closedResult.value.leadPhone,
      reason: input.reason,
      finalScore: closedResult.value.score.toNumber(),
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      occurredAt: this.now(),
      version: "1.0",
    });
    return ok(closedResult.value);
  }
}
