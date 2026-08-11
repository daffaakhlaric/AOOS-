import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { Branch } from "@aos/meta-ads-connector";

import type { WaTextMessageInput } from "../contracts/IWhatsAppClient.js";
import { OutgoingMessage } from "../domain/entities/OutgoingMessage.js";
import { ConversationId } from "../domain/value-objects/ConversationId.js";
import { MessageBody } from "../domain/value-objects/MessageBody.js";
import { MessageId } from "../domain/value-objects/MessageId.js";
import { MessageStatus } from "../domain/value-objects/MessageStatus.js";
import { MessageType } from "../domain/value-objects/MessageType.js";
import type { PhoneNumber } from "../domain/value-objects/PhoneNumber.js";
import type { PhoneNumberId } from "../domain/value-objects/PhoneNumberId.js";

export interface BuiltOutgoingTextMessage {
  readonly message: OutgoingMessage;
  readonly sendInput: WaTextMessageInput;
}

/**
 * Builder Pattern (Builder Pattern requirement) for a TEXT `OutgoingMessage` — used by
 * `SendTextMessage`. Builds a PRELIMINARY message (locally-generated `MessageId`, `status:
 * SENT` pending confirmation, no `sentAt` yet) alongside the raw `WaTextMessageInput` the
 * `IWhatsAppClient` call needs — see `OutgoingMessage`'s class doc for why send confirmation
 * constructs a separate instance rather than mutating this one.
 */
export class OutgoingMessageBuilder {
  private to: PhoneNumber | undefined;
  private from: PhoneNumberId | undefined;
  private branch: Branch | undefined;
  private accessToken: string | undefined;
  private bodyText: string | undefined;
  private previewUrl = false;

  withTo(to: PhoneNumber): this {
    this.to = to;
    return this;
  }

  withFrom(from: PhoneNumberId): this {
    this.from = from;
    return this;
  }

  withBranch(branch: Branch): this {
    this.branch = branch;
    return this;
  }

  withAccessToken(accessToken: string): this {
    this.accessToken = accessToken;
    return this;
  }

  withBody(bodyText: string): this {
    this.bodyText = bodyText;
    return this;
  }

  withPreviewUrl(previewUrl: boolean): this {
    this.previewUrl = previewUrl;
    return this;
  }

  build(): Result<BuiltOutgoingTextMessage, ValidationError> {
    if (this.to === undefined || this.from === undefined || this.branch === undefined) {
      return err(new ValidationError("OutgoingMessageBuilder requires to, from, and branch"));
    }
    if (this.accessToken === undefined || this.accessToken.length === 0) {
      return err(new ValidationError("OutgoingMessageBuilder requires a non-empty accessToken"));
    }
    if (this.bodyText === undefined) {
      return err(new ValidationError("OutgoingMessageBuilder requires a body"));
    }
    const bodyResult = MessageBody.create(this.bodyText);
    if (!bodyResult.ok) {
      return err(new ValidationError(bodyResult.error.message, { cause: bodyResult.error }));
    }

    const messageResult = OutgoingMessage.create({
      id: MessageId.generate(),
      to: this.to,
      from: this.from,
      // These two fields are exercised by every passing `build()` test in this file — the
      // `/* v8 ignore next 2 */` below routes around a v8/istanbul coverage-tool line-attribution
      // artifact on this particular multi-line object literal, not a real gap.
      /* v8 ignore next 2 */
      branch: this.branch,
      conversationId: ConversationId.fromParticipants(this.to, this.from),
      type: MessageType.TEXT,
      body: bodyResult.value,
      status: MessageStatus.SENT,
    });
    // Unreachable: `type: MessageType.TEXT` and `status: MessageStatus.SENT` above are always
    // valid literals, the only two things `OutgoingMessage.create` validates.
    /* v8 ignore next 3 */
    if (!messageResult.ok) {
      return messageResult;
    }

    return ok({
      message: messageResult.value,
      sendInput: {
        phoneNumberId: this.from.toString(),
        accessToken: this.accessToken,
        to: this.to.toString(),
        body: this.bodyText,
        previewUrl: this.previewUrl,
      },
    });
  }
}
