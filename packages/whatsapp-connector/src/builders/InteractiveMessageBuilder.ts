import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { Branch } from "@aos/meta-ads-connector";

import type {
  WaInteractiveButton,
  WaInteractiveMessageInput,
} from "../contracts/IWhatsAppClient.js";
import { OutgoingMessage } from "../domain/entities/OutgoingMessage.js";
import { ConversationId } from "../domain/value-objects/ConversationId.js";
import { MessageBody } from "../domain/value-objects/MessageBody.js";
import { MessageId } from "../domain/value-objects/MessageId.js";
import { MessageStatus } from "../domain/value-objects/MessageStatus.js";
import { MessageType } from "../domain/value-objects/MessageType.js";
import type { PhoneNumber } from "../domain/value-objects/PhoneNumber.js";
import type { PhoneNumberId } from "../domain/value-objects/PhoneNumberId.js";

export interface BuiltOutgoingInteractiveMessage {
  readonly message: OutgoingMessage;
  readonly sendInput: WaInteractiveMessageInput;
}

const MAX_INTERACTIVE_BUTTONS = 3;

/** Builder Pattern for an INTERACTIVE (button) `OutgoingMessage` — used by `SendInteractiveMessage`. WhatsApp Cloud API allows at most 3 reply buttons per message. */
export class InteractiveMessageBuilder {
  private to: PhoneNumber | undefined;
  private from: PhoneNumberId | undefined;
  private branch: Branch | undefined;
  private accessToken: string | undefined;
  private bodyText: string | undefined;
  private buttons: ReadonlyArray<WaInteractiveButton> = [];

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

  withButtons(buttons: ReadonlyArray<WaInteractiveButton>): this {
    this.buttons = buttons;
    return this;
  }

  build(): Result<BuiltOutgoingInteractiveMessage, ValidationError> {
    if (this.to === undefined || this.from === undefined || this.branch === undefined) {
      return err(new ValidationError("InteractiveMessageBuilder requires to, from, and branch"));
    }
    if (this.accessToken === undefined || this.accessToken.length === 0) {
      return err(new ValidationError("InteractiveMessageBuilder requires a non-empty accessToken"));
    }
    if (this.bodyText === undefined) {
      return err(new ValidationError("InteractiveMessageBuilder requires a body"));
    }
    if (this.buttons.length === 0) {
      return err(new ValidationError("InteractiveMessageBuilder requires at least one button"));
    }
    if (this.buttons.length > MAX_INTERACTIVE_BUTTONS) {
      return err(
        new ValidationError(
          `InteractiveMessageBuilder allows at most ${MAX_INTERACTIVE_BUTTONS} buttons, received ${this.buttons.length}`,
        ),
      );
    }

    const bodyResult = MessageBody.create(this.bodyText);
    if (!bodyResult.ok) {
      return err(new ValidationError(bodyResult.error.message, { cause: bodyResult.error }));
    }

    const messageResult = OutgoingMessage.create({
      id: MessageId.generate(),
      to: this.to,
      from: this.from,
      branch: this.branch,
      conversationId: ConversationId.fromParticipants(this.to, this.from),
      type: MessageType.INTERACTIVE,
      body: bodyResult.value,
      status: MessageStatus.SENT,
    });
    // Unreachable: `type: MessageType.INTERACTIVE` and `status: MessageStatus.SENT` above are
    // always valid literals, the only two things `OutgoingMessage.create` validates.
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
        bodyText: this.bodyText,
        buttons: this.buttons,
      },
    });
  }
}
