import { err, ok, type Result } from "@aos/common";

import type { LeadConversation } from "../../domain/entities/LeadConversation.js";
import type { ConversationError } from "../../domain/errors/ConversationError.js";
import type { ClaraAgentEvents } from "../../domain/events/ClaraAgentEvents.js";
import type { ConversationId } from "../../domain/value-objects/ConversationId.js";
import type { ClaraAgentService } from "../services/ClaraAgentService.js";

export interface CloseConversationInput {
  readonly conversationId: ConversationId;
  readonly reason: string;
  readonly tenantId: string;
  readonly correlationId: string;
}

/** Marks a conversation `CLOSED` and publishes `ConversationClosed` (spec "CloseConversation.ts"). */
export class CloseConversation {
  constructor(
    private readonly claraAgentService: ClaraAgentService,
    private readonly events: ClaraAgentEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    input: CloseConversationInput,
  ): Promise<Result<LeadConversation, ConversationError>> {
    const closedResult = this.claraAgentService.close(input.conversationId);
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
