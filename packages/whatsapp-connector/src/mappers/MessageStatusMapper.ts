import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import { MessageStatus } from "../domain/value-objects/MessageStatus.js";
import type { WaWebhookStatus } from "../types/WhatsAppWebhookTypes.js";

export interface MappedMessageStatus {
  readonly messageId: string;
  readonly recipientId: string;
  readonly status: MessageStatus;
  readonly at: Date;
  readonly errorCode: number | undefined;
  readonly errorTitle: string | undefined;
}

const WA_STATUS_TO_MESSAGE_STATUS: Readonly<Record<string, MessageStatus>> = {
  sent: MessageStatus.SENT,
  delivered: MessageStatus.DELIVERED,
  read: MessageStatus.READ,
  failed: MessageStatus.FAILED,
};

/** Maps a raw `WaWebhookStatus` (validated by `WebhookParser`) into a `MappedMessageStatus`. */
export class MessageStatusMapper {
  static map(raw: WaWebhookStatus): Result<MappedMessageStatus, ValidationError> {
    const status = WA_STATUS_TO_MESSAGE_STATUS[raw.status];
    // Unreachable: `WA_STATUS_TO_MESSAGE_STATUS` has an entry for every member of
    // `WaWebhookStatusSchema`'s Zod enum (the only possible values of `raw.status` once the
    // payload has passed `WebhookParser`), so this lookup can never miss.
    /* v8 ignore next 3 */
    if (status === undefined) {
      return err(new ValidationError(`Unsupported WhatsApp status value: ${raw.status}`));
    }
    const seconds = Number(raw.timestamp);
    if (!Number.isFinite(seconds)) {
      return err(new ValidationError(`Status update timestamp is not numeric: ${raw.timestamp}`));
    }
    const firstError = raw.errors?.[0];
    return ok({
      messageId: raw.id,
      recipientId: raw.recipient_id,
      status,
      at: new Date(seconds * 1000),
      errorCode: firstError?.code,
      errorTitle: firstError?.title,
    });
  }
}
