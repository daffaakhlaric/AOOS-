import { err, ok, type Result } from "@aos/common";
import { NotFoundError, ValidationError } from "@aos/errors";

import type { IncomingMessage } from "../../domain/entities/IncomingMessage.js";
import type { WabaAccount } from "../../domain/entities/WabaAccount.js";
import { PhoneNumberId } from "../../domain/value-objects/PhoneNumberId.js";
import { IncomingMessageMapper } from "../../mappers/IncomingMessageMapper.js";
import {
  MessageStatusMapper,
  type MappedMessageStatus,
} from "../../mappers/MessageStatusMapper.js";
import type { WaWebhookValue } from "../../types/WhatsAppWebhookTypes.js";
import { normalizeToE164 } from "../../utils/PhoneNumberFormatter.js";

import type { ConversationService } from "./ConversationService.js";

export interface ProcessedIncomingMessage {
  readonly message: IncomingMessage;
  readonly isFirstMessage: boolean;
}

export interface ProcessedWebhookValue {
  readonly incoming: ReadonlyArray<ProcessedIncomingMessage>;
  readonly statuses: ReadonlyArray<MappedMessageStatus>;
}

/**
 * Maps one already-branch-resolved `WaWebhookValue` (one `entry[].changes[].value`) into domain
 * `IncomingMessage`s (with `isFirstMessage` resolved via `ConversationService`, and the
 * conversation's message history advanced as a side effect) and status updates. Pure mapping +
 * `ConversationService` bookkeeping — publishing the resulting events is `ProcessIncomingWebhook`'s
 * job, kept separate so this class stays independently testable without an `IPublisher`.
 */
export class WebhookProcessorService {
  /** Last-known status per `wamid`, in-memory only (same process-lifetime-only convenience scope as `ConversationService`) — backs `GetMessageStatus`. */
  private readonly statuses = new Map<string, MappedMessageStatus>();

  constructor(private readonly conversations: ConversationService) {}

  getStatus(messageId: string): Result<MappedMessageStatus, NotFoundError> {
    const found = this.statuses.get(messageId);
    if (found === undefined) {
      return err(new NotFoundError(`No status recorded for message id "${messageId}"`));
    }
    return ok(found);
  }

  process(
    value: WaWebhookValue,
    waba: WabaAccount,
    at: Date,
  ): Result<ProcessedWebhookValue, ValidationError> {
    const incoming: ProcessedIncomingMessage[] = [];
    for (const raw of value.messages ?? []) {
      const fromResult = normalizeToE164(raw.from);
      if (!fromResult.ok) {
        return err(new ValidationError(fromResult.error.message, { cause: fromResult.error }));
      }
      const isFirstMessage = this.conversations.isNewConversation(
        fromResult.value,
        waba.phoneNumberId,
      );
      const conversation = this.conversations.getOrStart(
        fromResult.value,
        waba.phoneNumberId,
        waba.branch,
        at,
      );

      const mappedResult = IncomingMessageMapper.map(
        raw,
        waba.phoneNumberId,
        waba.branch,
        isFirstMessage,
      );
      if (!mappedResult.ok) {
        return err(mappedResult.error);
      }
      this.conversations.appendMessage(conversation.id, mappedResult.value.id, at);
      incoming.push({ message: mappedResult.value, isFirstMessage });
    }

    const statuses: MappedMessageStatus[] = [];
    for (const raw of value.statuses ?? []) {
      const mappedResult = MessageStatusMapper.map(raw);
      if (!mappedResult.ok) {
        return err(mappedResult.error);
      }
      statuses.push(mappedResult.value);
      this.statuses.set(mappedResult.value.messageId, mappedResult.value);
    }

    return ok({ incoming, statuses });
  }

  /** Resolves the `PhoneNumberId` the WABA received this value on — a small helper kept here so callers never construct the VO themselves from raw webhook metadata. */
  static phoneNumberIdOf(value: WaWebhookValue): Result<PhoneNumberId, ValidationError> {
    return PhoneNumberId.create(value.metadata.phone_number_id);
  }
}
