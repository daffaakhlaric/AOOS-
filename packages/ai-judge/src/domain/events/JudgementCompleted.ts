/** Published once `JudgeConversation` produces a `JudgementResult` (topic `aaos.judge.judgement.completed`). */
export interface JudgementCompleted {
  readonly judgementId: string;
  readonly sessionId: string;
  readonly personaId: string;
  readonly overallScore: number;
  readonly grade: string;
  readonly verdict: string;
  readonly isGoldenCandidate: boolean;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
