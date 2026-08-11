import type { Result } from "@aos/common";

import type { Conversation } from "../domain/entities/Conversation.js";
import type { SupabaseError } from "../domain/errors/SupabaseError.js";
import type { ConversationId } from "../domain/value-objects/ConversationId.js";
import type { LeadId } from "../domain/value-objects/LeadId.js";

/** Repository contract for `conversations`. */
export interface IConversationRepository {
  findById(id: ConversationId): Promise<Result<Conversation | undefined, SupabaseError>>;
  findByLeadId(leadId: LeadId): Promise<Result<Conversation | undefined, SupabaseError>>;
  insert(conversation: Conversation): Promise<Result<Conversation, SupabaseError>>;
  update(conversation: Conversation): Promise<Result<Conversation, SupabaseError>>;
}
