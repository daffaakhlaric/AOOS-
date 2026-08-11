/** Payload for `aaos.lead-store.conversation.updated`, emitted whenever `SaveMessage` persists a new message. */
export interface ConversationUpdated {
  readonly conversationId: string;
  readonly leadId: string;
  readonly direction: "INCOMING" | "OUTGOING";
  readonly messageCount: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
