/** Payload for `aaos.sales.conversation.closed`, emitted when `CloseConversation` marks a conversation as `CLOSED`. */
export interface ConversationClosed {
  readonly conversationId: string;
  readonly leadPhone: string;
  readonly reason: string;
  readonly finalScore: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
