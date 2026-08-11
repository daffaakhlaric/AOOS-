import type { Branch } from "@aos/meta-ads-connector";

/** Payload for `aaos.whatsapp.conversation.started`, emitted the first time `ConversationService` sees a lead+WABA pair. */
export interface ConversationStarted {
  readonly conversationId: string;
  readonly leadPhone: string;
  readonly branch: Branch;
  readonly phoneNumberId: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
