import { err, ok, type Result } from "@aos/common";

import type { IMessageRepository } from "../../contracts/IMessageRepository.js";
import type { Message } from "../../domain/entities/Message.js";
import { SupabaseError } from "../../domain/errors/SupabaseError.js";
import type { ConversationId } from "../../domain/value-objects/ConversationId.js";
import { MessageMapper, type MessageRow } from "../mappers/MessageMapper.js";

import type { SupabaseClientLike } from "./SupabaseTypes.js";

const TABLE = "messages";

/** Supabase implementation of `IMessageRepository`. */
export class MessageRepository implements IMessageRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async insert(message: Message): Promise<Result<Message, SupabaseError>> {
    const { data, error } = await this.client
      .from<MessageRow>(TABLE)
      .insert(MessageMapper.toRow(message))
      .select("*")
      .single();
    if (error !== null) {
      return err(new SupabaseError(`MessageRepository.insert failed: ${error.message}`));
    }
    if (data === null) {
      return err(new SupabaseError("MessageRepository.insert failed: no row returned"));
    }
    const mapped = MessageMapper.toDomain(data);
    if (!mapped.ok) {
      return err(
        new SupabaseError(`MessageRepository: row mapping failed: ${mapped.error.message}`),
      );
    }
    return ok(mapped.value);
  }

  async findByConversationId(
    conversationId: ConversationId,
  ): Promise<Result<readonly Message[], SupabaseError>> {
    const { data, error } = await this.client
      .from<MessageRow>(TABLE)
      .select("*")
      .eq("conversation_id", conversationId.toString())
      .order("created_at", { ascending: true });
    if (error !== null) {
      return err(
        new SupabaseError(`MessageRepository.findByConversationId failed: ${error.message}`),
      );
    }
    const messages: Message[] = [];
    for (const row of data ?? []) {
      const mapped = MessageMapper.toDomain(row);
      if (!mapped.ok) {
        return err(
          new SupabaseError(`MessageRepository: row mapping failed: ${mapped.error.message}`),
        );
      }
      messages.push(mapped.value);
    }
    return ok(messages);
  }
}
