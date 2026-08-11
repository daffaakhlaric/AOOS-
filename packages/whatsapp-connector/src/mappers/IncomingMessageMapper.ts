import { err, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { Branch } from "@aos/meta-ads-connector";

import { IncomingMessage } from "../domain/entities/IncomingMessage.js";
import { ConversationId } from "../domain/value-objects/ConversationId.js";
import { MessageBody } from "../domain/value-objects/MessageBody.js";
import { MessageId } from "../domain/value-objects/MessageId.js";
import { MessageType } from "../domain/value-objects/MessageType.js";
import type { PhoneNumber } from "../domain/value-objects/PhoneNumber.js";
import type { PhoneNumberId } from "../domain/value-objects/PhoneNumberId.js";
import type { WaWebhookMessage } from "../types/WhatsAppWebhookTypes.js";
import { normalizeToE164 } from "../utils/PhoneNumberFormatter.js";

const WA_TYPE_TO_MESSAGE_TYPE: Readonly<Record<string, MessageType>> = {
  text: MessageType.TEXT,
  image: MessageType.IMAGE,
  document: MessageType.DOCUMENT,
  interactive: MessageType.INTERACTIVE,
  button: MessageType.INTERACTIVE,
  audio: MessageType.DOCUMENT,
};

/** Maps a raw `WaWebhookMessage` (validated by `WebhookParser`) into a domain `IncomingMessage`. */
export class IncomingMessageMapper {
  static map(
    raw: WaWebhookMessage,
    to: PhoneNumberId,
    branch: Branch,
    isFirstMessage: boolean,
  ): Result<IncomingMessage, ValidationError> {
    const fromResult = normalizeToE164(raw.from);
    if (!fromResult.ok) {
      return err(new ValidationError(fromResult.error.message, { cause: fromResult.error }));
    }
    const from: PhoneNumber = fromResult.value;

    const idResult = MessageId.create(raw.id);
    if (!idResult.ok) {
      return err(idResult.error);
    }

    const type = WA_TYPE_TO_MESSAGE_TYPE[raw.type];
    // Unreachable: `WA_TYPE_TO_MESSAGE_TYPE` has an entry for every member of
    // `WaWebhookMessageTypeSchema`'s Zod enum (the only possible values of `raw.type` once the
    // payload has passed `WebhookParser`), so this lookup can never miss.
    /* v8 ignore next 3 */
    if (type === undefined) {
      return err(new ValidationError(`Unsupported incoming WhatsApp message type: ${raw.type}`));
    }

    let body: MessageBody | undefined;
    if (type === MessageType.TEXT) {
      if (raw.text === undefined) {
        return err(new ValidationError('Incoming text message is missing "text.body"'));
      }
      const bodyResult = MessageBody.create(raw.text.body);
      if (!bodyResult.ok) {
        return err(new ValidationError(bodyResult.error.message, { cause: bodyResult.error }));
      }
      body = bodyResult.value;
    } else if (type === MessageType.INTERACTIVE && raw.interactive?.button_reply !== undefined) {
      const bodyResult = MessageBody.create(raw.interactive.button_reply.title);
      if (bodyResult.ok) {
        body = bodyResult.value;
      }
    }

    const timestampSeconds = Number(raw.timestamp);
    if (!Number.isFinite(timestampSeconds)) {
      return err(
        new ValidationError(`Incoming message timestamp is not numeric: ${raw.timestamp}`),
      );
    }

    const conversationId = ConversationId.fromParticipants(from, to);

    return IncomingMessage.create({
      id: idResult.value,
      from,
      to,
      branch,
      conversationId,
      type,
      body,
      timestamp: new Date(timestampSeconds * 1000),
      isFirstMessage,
    });
  }
}
