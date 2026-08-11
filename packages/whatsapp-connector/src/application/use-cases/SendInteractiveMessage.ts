import { err, ok, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";
import type { Logger } from "@aos/logger";
import type { Branch } from "@aos/meta-ads-connector";

import { InteractiveMessageBuilder } from "../../builders/InteractiveMessageBuilder.js";
import type { IWabaRegistry } from "../../contracts/IWabaRegistry.js";
import type { WaInteractiveButton } from "../../contracts/IWhatsAppClient.js";
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

export interface SendInteractiveMessageInput {
  readonly branch: Branch;
  readonly to: string;
  readonly body: string;
  readonly buttons: ReadonlyArray<WaInteractiveButton>;
  readonly tenantId: string;
  readonly correlationId: string;
}

export type SendInteractiveMessageError =
  WhatsAppApiError | InvalidPhoneNumberError | WabaNotFoundError | ValidationError;

/** Sends an interactive reply-button WhatsApp message for a branch — only valid within an already-open 24h customer-service window (session message). */
export class SendInteractiveMessage {
  constructor(
    private readonly registry: IWabaRegistry,
    private readonly sender: MessageSenderService,
    private readonly events: WhatsAppConnectorEvents,
    private readonly accessToken: string,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(
    input: SendInteractiveMessageInput,
  ): Promise<Result<OutgoingMessage, SendInteractiveMessageError>> {
    return this.tracer.startActiveSpan(
      "whatsapp-connector.send-interactive-message",
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

          const builtResult = new InteractiveMessageBuilder()
            .withTo(toResult.value)
            .withFrom(waba.phoneNumberId)
            .withBranch(waba.branch)
            .withAccessToken(this.accessToken)
            .withBody(input.body)
            .withButtons(input.buttons)
            .build();
          if (!builtResult.ok) {
            return err(builtResult.error);
          }

          const sendResult = await this.sender.sendInteractive(
            builtResult.value.message,
            builtResult.value.sendInput,
          );
          if (!sendResult.ok) {
            this.logger.warn(
              { error: sendResult.error.message },
              "whatsapp-connector: send interactive message failed",
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
