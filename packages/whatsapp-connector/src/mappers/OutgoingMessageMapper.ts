import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { OutgoingMessage } from "../domain/entities/OutgoingMessage.js";
import { MessageId } from "../domain/value-objects/MessageId.js";
import type { WaSendMessageResponse } from "../types/WhatsAppApiTypes.js";

/** Confirms a preliminary `OutgoingMessage` with the real Meta `wamid` from a successful send response — see `OutgoingMessage`'s class doc for why this constructs a NEW instance rather than mutating. */
export class OutgoingMessageMapper {
  static confirmFromResponse(
    preliminary: OutgoingMessage,
    response: WaSendMessageResponse,
    sentAt: Date,
  ): Result<OutgoingMessage, ValidationError> {
    const wamid = response.messages[0]?.id;
    if (wamid === undefined) {
      return err(new ValidationError("WhatsApp Cloud API send response contained no message id"));
    }
    const idResult = MessageId.create(wamid);
    if (!idResult.ok) {
      return err(idResult.error);
    }
    return ok(preliminary.withConfirmedSend(idResult.value, sentAt));
  }
}
