import type { Result } from "@aos/common";

import type { Conversation } from "../../domain/entities/Conversation.js";
import type { Message } from "../../domain/entities/Message.js";
import type { LeadStoreError } from "../../domain/errors/LeadStoreError.js";
import type { GetConversation } from "../use-cases/GetConversation.js";
import type { SaveMessage, SaveMessageInput } from "../use-cases/SaveMessage.js";

/** Facade over conversation/message use cases — the composition `LeadStoreFactory` wires as `ConversationService`. */
export class ConversationService {
  constructor(
    private readonly saveMessage: SaveMessage,
    private readonly getConversation: GetConversation,
  ) {}

  save(input: SaveMessageInput): Promise<Result<Message, LeadStoreError>> {
    return this.saveMessage.execute(input);
  }

  byLeadId(leadId: string): Promise<Result<Conversation, LeadStoreError>> {
    return this.getConversation.execute(leadId);
  }
}
