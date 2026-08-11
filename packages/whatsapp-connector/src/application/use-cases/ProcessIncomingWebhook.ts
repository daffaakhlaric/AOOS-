import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";
import type { Branch } from "@aos/meta-ads-connector";

import type { IMessageWebhookParser } from "../../contracts/IMessageWebhookParser.js";
import type { IWabaRegistry } from "../../contracts/IWabaRegistry.js";
import type { WebhookError } from "../../domain/errors/index.js";
import type { WhatsAppConnectorEvents } from "../../domain/events/WhatsAppConnectorEvents.js";
import { MessageStatus } from "../../domain/value-objects/MessageStatus.js";
import { PhoneNumberId } from "../../domain/value-objects/PhoneNumberId.js";
import type { WebhookVerifier } from "../../infrastructure/webhook/WebhookVerifier.js";
import type { WebhookProcessorService } from "../services/WebhookProcessorService.js";
import type { Tracer } from "../tracer.js";

export interface ProcessIncomingWebhookInput {
  readonly rawBody: string;
  /** `X-Hub-Signature-256` header value. */
  readonly signature: string | undefined;
  readonly webhookAppSecret: string;
  readonly tenantId: string;
  readonly correlationId: string;
}

export interface ProcessIncomingWebhookResult {
  readonly messagesReceived: number;
  readonly statusesProcessed: number;
}

/**
 * Main webhook entry point: verify signature → parse payload → for every `entry[].changes[]`
 * value, resolve its branch via `IWabaRegistry` → map to domain messages/statuses via
 * `WebhookProcessorService` → emit events. Per the spec's "unknown phone_number_id"
 * scenario, an unrecognized `phone_number_id` is logged and SKIPPED (not a fatal error) — this
 * use case still returns `Result.ok` for the batch. Only a bad signature or unparsable payload
 * fails the whole call; the caller (`apps/aaos-api`'s HTTP layer) is where the always-200 rule to
 * Meta lives — this use case's `Result` is unrelated to that HTTP-layer contract, see the
 * engineering report's resolution on the two-layer split.
 */
export class ProcessIncomingWebhook {
  constructor(
    private readonly verifier: WebhookVerifier,
    private readonly parser: IMessageWebhookParser,
    private readonly registry: IWabaRegistry,
    private readonly webhookProcessor: WebhookProcessorService,
    private readonly events: WhatsAppConnectorEvents,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    input: ProcessIncomingWebhookInput,
  ): Promise<Result<ProcessIncomingWebhookResult, WebhookError>> {
    return this.tracer.startActiveSpan(
      "whatsapp-connector.process-incoming-webhook",
      async (span: { end: () => void }) => {
        try {
          const signatureResult = this.verifier.verifySignature(
            input.rawBody,
            input.signature,
            input.webhookAppSecret,
          );
          if (!signatureResult.ok) {
            this.logger.warn(
              { error: signatureResult.error.message },
              "whatsapp-connector: webhook signature verification failed",
            );
            return err(signatureResult.error);
          }

          const parseResult = this.parser.parse(input.rawBody);
          if (!parseResult.ok) {
            this.logger.warn(
              { error: parseResult.error.message },
              "whatsapp-connector: webhook payload failed validation",
            );
            return err(parseResult.error);
          }

          const at = this.now();
          let messagesReceived = 0;
          let statusesProcessed = 0;

          for (const entry of parseResult.value.entry) {
            for (const change of entry.changes) {
              const value = change.value;
              const phoneNumberIdResult = PhoneNumberId.create(value.metadata.phone_number_id);
              if (!phoneNumberIdResult.ok) {
                this.logger.warn(
                  { error: phoneNumberIdResult.error.message },
                  "whatsapp-connector: webhook value has an invalid phone_number_id",
                );
                continue;
              }
              const wabaResult = this.registry.getByPhoneNumberId(phoneNumberIdResult.value);
              if (!wabaResult.ok) {
                this.logger.warn(
                  { phoneNumberId: phoneNumberIdResult.value.toString() },
                  "whatsapp-connector: webhook value references an unregistered phone_number_id — skipped",
                );
                continue;
              }
              const waba = wabaResult.value;

              const processedResult = this.webhookProcessor.process(value, waba, at);
              if (!processedResult.ok) {
                this.logger.warn(
                  { error: processedResult.error.message },
                  "whatsapp-connector: webhook value failed mapping — skipped",
                );
                continue;
              }

              for (const { message, isFirstMessage } of processedResult.value.incoming) {
                if (isFirstMessage) {
                  await this.events.publishConversationStarted({
                    conversationId: message.conversationId.toString(),
                    leadPhone: message.from.toString(),
                    branch: waba.branch,
                    phoneNumberId: waba.phoneNumberId.toString(),
                    tenantId: input.tenantId,
                    correlationId: input.correlationId,
                    occurredAt: at,
                    version: "1.0",
                  });
                }
                await this.events.publishMessageReceived({
                  messageId: message.id.toString(),
                  conversationId: message.conversationId.toString(),
                  from: message.from.toString(),
                  to: message.to.toString(),
                  branch: waba.branch,
                  phoneNumberId: waba.phoneNumberId.toString(),
                  type: message.type,
                  body: message.body?.toString(),
                  isFirstMessage,
                  tenantId: input.tenantId,
                  correlationId: input.correlationId,
                  occurredAt: message.timestamp,
                  version: "1.0",
                });
                messagesReceived += 1;
              }

              for (const status of processedResult.value.statuses) {
                await this.publishStatusEvent(status, waba, input.tenantId, input.correlationId);
                statusesProcessed += 1;
              }
            }
          }

          this.logger.info(
            { messagesReceived, statusesProcessed },
            "whatsapp-connector: webhook processed",
          );
          return ok({ messagesReceived, statusesProcessed });
        } finally {
          span.end();
        }
      },
    );
  }

  private async publishStatusEvent(
    status: {
      readonly messageId: string;
      readonly recipientId: string;
      readonly status: MessageStatus;
      readonly at: Date;
      readonly errorCode: number | undefined;
      readonly errorTitle: string | undefined;
    },
    waba: { readonly branch: Branch; readonly phoneNumberId: PhoneNumberId },
    tenantId: string,
    correlationId: string,
  ): Promise<void> {
    const base = {
      messageId: status.messageId,
      recipientId: status.recipientId,
      branch: waba.branch,
      phoneNumberId: waba.phoneNumberId.toString(),
      tenantId,
      correlationId,
      occurredAt: status.at,
      version: "1.0" as const,
    };
    if (status.status === MessageStatus.DELIVERED) {
      await this.events.publishMessageDelivered(base);
      return;
    }
    if (status.status === MessageStatus.READ) {
      await this.events.publishMessageRead(base);
      return;
    }
    if (status.status === MessageStatus.FAILED) {
      await this.events.publishMessageFailed({
        ...base,
        errorCode: status.errorCode,
        errorTitle: status.errorTitle,
      });
      return;
    }
    // status.status === MessageStatus.SENT: no dedicated event — send confirmation already
    // published `MessageSent` at send time (see `SendTextMessage` et al.); an inbound "sent"
    // status webhook entry is Meta's own echo of that, not new information.
  }
}
