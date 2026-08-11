import type { Result } from "@aos/common";
import type { NotFoundError } from "@aos/errors";

import type { Conversation } from "../../domain/entities/Conversation.js";
import type { ConversationId } from "../../domain/value-objects/ConversationId.js";
import type { ConversationService } from "../services/ConversationService.js";

/** Thin read wrapper around `ConversationService.get` — a stable public API surface for looking up an in-memory conversation thread. */
export class GetConversation {
  constructor(private readonly conversations: ConversationService) {}

  execute(conversationId: ConversationId): Result<Conversation, NotFoundError> {
    return this.conversations.get(conversationId);
  }
}
