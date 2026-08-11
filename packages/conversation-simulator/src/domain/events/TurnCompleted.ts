/** Published after each simulated turn (buyer message + Jessy response) completes (topic `aaos.simulator.turn.completed`). */
export interface TurnCompleted {
  readonly sessionId: string;
  readonly personaId: string;
  readonly turn: number;
  readonly score: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
