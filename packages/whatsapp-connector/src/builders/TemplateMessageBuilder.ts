import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { Branch } from "@aos/meta-ads-connector";

import type { WaTemplateMessageInput } from "../contracts/IWhatsAppClient.js";
import { OutgoingMessage } from "../domain/entities/OutgoingMessage.js";
import { ConversationId } from "../domain/value-objects/ConversationId.js";
import { MessageBody } from "../domain/value-objects/MessageBody.js";
import { MessageId } from "../domain/value-objects/MessageId.js";
import { MessageStatus } from "../domain/value-objects/MessageStatus.js";
import { MessageType } from "../domain/value-objects/MessageType.js";
import type { PhoneNumber } from "../domain/value-objects/PhoneNumber.js";
import type { PhoneNumberId } from "../domain/value-objects/PhoneNumberId.js";

export interface BuiltOutgoingTemplateMessage {
  readonly message: OutgoingMessage;
  readonly sendInput: WaTemplateMessageInput;
}

/**
 * Builder Pattern for a TEMPLATE `OutgoingMessage` — used by `SendTemplateMessage`. The domain
 * `OutgoingMessage.body` for a template send is a human-readable rendering
 * (`"<templateName>(<param1>, <param2>, ...)"`) kept for tracking/eventing purposes; the actual
 * WhatsApp Cloud API request uses the structured `sendInput.bodyParameters` array, per the spec's
 * "Send Template Message" wire format.
 */
export class TemplateMessageBuilder {
  private to: PhoneNumber | undefined;
  private from: PhoneNumberId | undefined;
  private branch: Branch | undefined;
  private accessToken: string | undefined;
  private templateName: string | undefined;
  private languageCode = "id";
  private bodyParameters: ReadonlyArray<string> = [];

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

  withTemplateName(templateName: string): this {
    this.templateName = templateName;
    return this;
  }

  withLanguageCode(languageCode: string): this {
    this.languageCode = languageCode;
    return this;
  }

  withBodyParameters(bodyParameters: ReadonlyArray<string>): this {
    this.bodyParameters = bodyParameters;
    return this;
  }

  build(): Result<BuiltOutgoingTemplateMessage, ValidationError> {
    if (this.to === undefined || this.from === undefined || this.branch === undefined) {
      return err(new ValidationError("TemplateMessageBuilder requires to, from, and branch"));
    }
    if (this.accessToken === undefined || this.accessToken.length === 0) {
      return err(new ValidationError("TemplateMessageBuilder requires a non-empty accessToken"));
    }
    if (this.templateName === undefined || this.templateName.trim().length === 0) {
      return err(new ValidationError("TemplateMessageBuilder requires a non-empty templateName"));
    }

    const renderedBody = `${this.templateName}(${this.bodyParameters.join(", ")})`;
    const bodyResult = MessageBody.create(renderedBody);
    if (!bodyResult.ok) {
      return err(new ValidationError(bodyResult.error.message, { cause: bodyResult.error }));
    }

    const messageResult = OutgoingMessage.create({
      id: MessageId.generate(),
      to: this.to,
      from: this.from,
      branch: this.branch,
      conversationId: ConversationId.fromParticipants(this.to, this.from),
      type: MessageType.TEMPLATE,
      body: bodyResult.value,
      status: MessageStatus.SENT,
    });
    // Unreachable: `type: MessageType.TEMPLATE` and `status: MessageStatus.SENT` above are always
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
        templateName: this.templateName,
        languageCode: this.languageCode,
        bodyParameters: this.bodyParameters,
      },
    });
  }
}
