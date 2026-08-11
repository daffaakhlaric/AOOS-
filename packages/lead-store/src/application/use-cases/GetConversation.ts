import { err, ErrorCode, ok, type Result } from "@aos/common";

import type { IConversationRepository } from "../../contracts/IConversationRepository.js";
import type { Conversation } from "../../domain/entities/Conversation.js";
import { ConversationNotFoundError } from "../../domain/errors/ConversationNotFoundError.js";
import { LeadStoreError } from "../../domain/errors/LeadStoreError.js";
import { LeadId } from "../../domain/value-objects/LeadId.js";

/** Fetches a lead's conversation thread by lead id. */
export class GetConversation {
  constructor(private readonly conversationRepository: IConversationRepository) {}

  async execute(leadId: string): Promise<Result<Conversation, LeadStoreError>> {
    const idResult = LeadId.create(leadId);
    if (!idResult.ok) {
      return err(new LeadStoreError(idResult.error.message, { code: ErrorCode.VALIDATION_ERROR }));
    }
    const findResult = await this.conversationRepository.findByLeadId(idResult.value);
    if (!findResult.ok) {
      return err(findResult.error);
    }
    if (findResult.value === undefined) {
      return err(new ConversationNotFoundError(`Conversation not found for lead: ${leadId}`));
    }
    return ok(findResult.value);
  }
}
