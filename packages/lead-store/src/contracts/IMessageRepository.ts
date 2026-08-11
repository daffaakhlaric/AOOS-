import type { Result } from "@aos/common";

import type { Message } from "../domain/entities/Message.js";
import type { SupabaseError } from "../domain/errors/SupabaseError.js";
import type { ConversationId } from "../domain/value-objects/ConversationId.js";

/** Repository contract for `messages`. */
export interface IMessageRepository {
  insert(message: Message): Promise<Result<Message, SupabaseError>>;
  findByConversationId(
    conversationId: ConversationId,
  ): Promise<Result<readonly Message[], SupabaseError>>;
}
