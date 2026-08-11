import type { ConversationStage } from "../value-objects/ConversationStage.js";

/** Payload for `aaos.sales.message.processed`, emitted after `ConversationPipeline` finishes reasoning about one inbound message. */
export interface MessageProcessed {
  readonly conversationId: string;
  readonly leadPhone: string;
  readonly stage: ConversationStage;
  readonly score: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
