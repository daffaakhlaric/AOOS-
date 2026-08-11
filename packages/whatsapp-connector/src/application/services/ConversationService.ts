import { err, ok, type Result } from "@aos/common";
import { NotFoundError } from "@aos/errors";
import type { Branch } from "@aos/meta-ads-connector";

import { Conversation } from "../../domain/entities/Conversation.js";
import { ConversationId } from "../../domain/value-objects/ConversationId.js";
import type { MessageId } from "../../domain/value-objects/MessageId.js";
import type { PhoneNumber } from "../../domain/value-objects/PhoneNumber.js";
import type { PhoneNumberId } from "../../domain/value-objects/PhoneNumberId.js";

/**
 * In-memory, process-lifetime-only bookkeeping of WhatsApp threads, keyed by `leadPhone` +
 * `wabaPhoneNumberId` (via `ConversationId.fromParticipants`). Per the package's own scope, this
 * does NOT persist anything — `@aos/lead-store` is the future persistent store. Its only real
 * jobs are: (1) answer `isFirstMessage` for `ProcessIncomingWebhook`, and (2) back `GetConversation`.
 */
export class ConversationService {
  private readonly conversations = new Map<string, Conversation>();

  /** True iff no `Conversation` has been recorded yet for this lead+WABA pair. */
  isNewConversation(leadPhone: PhoneNumber, wabaPhoneNumberId: PhoneNumberId): boolean {
    const id = ConversationId.fromParticipants(leadPhone, wabaPhoneNumberId);
    return !this.conversations.has(id.toString());
  }

  /** Returns the existing `Conversation` for this pair, or creates+stores a fresh ACTIVE one with zero messages. */
  getOrStart(
    leadPhone: PhoneNumber,
    wabaPhoneNumberId: PhoneNumberId,
    branch: Branch,
    at: Date,
  ): Conversation {
    const id = ConversationId.fromParticipants(leadPhone, wabaPhoneNumberId);
    const existing = this.conversations.get(id.toString());
    if (existing !== undefined) {
      return existing;
    }
    // Every field below is a valid-by-construction literal, so `Conversation.create` cannot fail.
    const createResult = Conversation.create({
      id,
      leadPhone,
      wabaPhoneNumberId,
      branch,
      messages: [],
      startedAt: at,
      lastMessageAt: at,
      messageCount: 0,
      status: "ACTIVE",
    });
    /* v8 ignore next 3 */
    if (!createResult.ok) {
      throw createResult.error;
    }
    this.conversations.set(id.toString(), createResult.value);
    return createResult.value;
  }

  /** Appends a message to the conversation's history and advances `lastMessageAt`. */
  appendMessage(conversationId: ConversationId, messageId: MessageId, at: Date): Conversation {
    const existing = this.conversations.get(conversationId.toString());
    // Guarded by callers always invoking `getOrStart` first — defensive fallback keeps this total.
    /* v8 ignore next 3 */
    if (existing === undefined) {
      throw new NotFoundError(`No conversation started for id "${conversationId.toString()}"`);
    }
    const updated = existing.withNewMessage(messageId, at);
    this.conversations.set(conversationId.toString(), updated);
    return updated;
  }

  get(conversationId: ConversationId): Result<Conversation, NotFoundError> {
    const found = this.conversations.get(conversationId.toString());
    if (found === undefined) {
      return err(new NotFoundError(`No conversation found for id "${conversationId.toString()}"`));
    }
    return ok(found);
  }

  listAll(): ReadonlyArray<Conversation> {
    return [...this.conversations.values()];
  }
}
