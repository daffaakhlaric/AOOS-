import { err, ok, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";
import type { Logger } from "@aos/logger";
import type { Branch } from "@aos/meta-ads-connector";

import { OutgoingMessageBuilder } from "../../builders/OutgoingMessageBuilder.js";
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

export interface SendTextMessageInput {
  readonly branch: Branch;
  readonly to: string; // any recognized Indonesian phone number format
  readonly body: string;
  readonly previewUrl?: boolean;
  readonly tenantId: string;
  readonly correlationId: string;
}

export type SendTextMessageError =
  WhatsAppApiError | InvalidPhoneNumberError | WabaNotFoundError | ValidationError;

/** Sends a free-text WhatsApp message for a branch — resolves the branch's `WabaAccount` via `IWabaRegistry`, normalizes `to`, sends via `MessageSenderService`, and emits `MessageSent`. */
export class SendTextMessage {
  constructor(
    private readonly registry: IWabaRegistry,
    private readonly sender: MessageSenderService,
    private readonly events: WhatsAppConnectorEvents,
    private readonly accessToken: string,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(
    input: SendTextMessageInput,
  ): Promise<Result<OutgoingMessage, SendTextMessageError>> {
    return this.tracer.startActiveSpan(
      "whatsapp-connector.send-text-message",
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

          const builtResult = new OutgoingMessageBuilder()
            .withTo(toResult.value)
            .withFrom(waba.phoneNumberId)
            .withBranch(waba.branch)
            .withAccessToken(this.accessToken)
            .withBody(input.body)
            .withPreviewUrl(input.previewUrl ?? false)
            .build();
          if (!builtResult.ok) {
            return err(builtResult.error);
          }

          const sendResult = await this.sender.sendText(
            builtResult.value.message,
            builtResult.value.sendInput,
          );
          if (!sendResult.ok) {
            this.logger.warn(
              { error: sendResult.error.message },
              "whatsapp-connector: send text message failed",
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
            // `sentAt` is always set at this point — `MessageSenderService.dispatch` only ever
            // returns via `OutgoingMessageMapper.confirmFromResponse`, which always sets it. The
            // `?? new Date()` fallback exists only to satisfy `sentAt`'s optional type; unreachable
            // in practice.
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
