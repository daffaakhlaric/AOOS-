/** Published once `SaveGoldenConversation` stores a new golden-dataset entry (topic `aaos.judge.golden-conversation.saved`). */
export interface GoldenConversationSaved {
  readonly goldenConversationId: string;
  readonly sessionId: string;
  readonly personaId: string;
  readonly overallScore: number;
  readonly tags: ReadonlyArray<string>;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
