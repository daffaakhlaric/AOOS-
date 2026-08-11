import { err, ok, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";
import type { Logger } from "@aos/logger";
import type { Branch } from "@aos/meta-ads-connector";

import { TemplateMessageBuilder } from "../../builders/TemplateMessageBuilder.js";
import type { IWabaRegistry } from "../../contracts/IWabaRegistry.js";
import type { OutgoingMessage } from "../../domain/entities/OutgoingMessage.js";
import type {
  InvalidPhoneNumberError,
  WabaNotFoundError,
  WhatsAppApiError,
} from "../../domain/errors/index.js";
import type { WhatsAppConnectorEvents } from "../../domain/events/WhatsAppConnectorEvents.js";
import { normalizeToE164 } from "../../utils/PhoneNumberFormatter.js";
import type { MessageSenderService } from "../services/MessageSenderService.js";
import type { Tracer } from "../tracer.js";

export interface SendTemplateMessageInput {
  readonly branch: Branch;
  readonly to: string;
  readonly templateName: string;
  readonly languageCode?: string;
  readonly bodyParameters: ReadonlyArray<string>;
  readonly tenantId: string;
  readonly correlationId: string;
}

export type SendTemplateMessageError =
  WhatsAppApiError | InvalidPhoneNumberError | WabaNotFoundError | ValidationError;

/** Sends a pre-approved template WhatsApp message for a branch — the only send path allowed to open a new business-initiated conversation window. */
export class SendTemplateMessage {
  constructor(
    private readonly registry: IWabaRegistry,
    private readonly sender: MessageSenderService,
    private readonly events: WhatsAppConnectorEvents,
    private readonly accessToken: string,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(
    input: SendTemplateMessageInput,
  ): Promise<Result<OutgoingMessage, SendTemplateMessageError>> {
    return this.tracer.startActiveSpan(
      "whatsapp-connector.send-template-message",
      async (span: { end: () => void }) => {
        try {
          const toResult = normalizeToE164(input.to);
          if (!toResult.ok) {
            return err(toResult.error);
          }
          const wabaResult = this.registry.getByBranch(input.branch);
          if (!wabaResult.ok) {
            return err(wabaResult.error);
          }
          const waba = wabaResult.value;

          const builtResult = new TemplateMessageBuilder()
            .withTo(toResult.value)
            .withFrom(waba.phoneNumberId)
            .withBranch(waba.branch)
            .withAccessToken(this.accessToken)
            .withTemplateName(input.templateName)
            .withLanguageCode(input.languageCode ?? "id")
            .withBodyParameters(input.bodyParameters)
            .build();
          if (!builtResult.ok) {
            return err(builtResult.error);
          }

          const sendResult = await this.sender.sendTemplate(
            builtResult.value.message,
            builtResult.value.sendInput,
          );
          if (!sendResult.ok) {
            this.logger.warn(
              { error: sendResult.error.message },
              "whatsapp-connector: send template message failed",
            );
            return err(sendResult.error);
          }

          await this.events.publishMessageSent({
            messageId: sendResult.value.id.toString(),
            conversationId: sendResult.value.conversationId.toString(),
            to: sendResult.value.to.toString(),
            from: sendResult.value.from.toString(),
            branch: sendResult.value.branch,
            phoneNumberId: sendResult.value.from.toString(),
            type: sendResult.value.type,
            tenantId: input.tenantId,
            correlationId: input.correlationId,
            // See `SendTextMessage`'s identical comment — `sentAt` is always set at this point.
            /* v8 ignore next */
            occurredAt: sendResult.value.sentAt ?? new Date(),
            version: "1.0",
          });

          return ok(sendResult.value);
        } finally {
          span.end();
        }
      },
    );
  }
}
