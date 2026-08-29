/** Published the instant Clara's real `HandoffTriggered` fires during a simulated turn (topic `aaos.simulator.handoff.reached`) — the same turn that ends the session as `COMPLETED` (design resolution #2a). */
export interface HandoffReached {
  readonly sessionId: string;
  readonly personaId: string;
  readonly turn: number;
  readonly score: number;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
