/** Published when a session ends as `FAILED` — either a thrown exception or an unexpected `err` Result from Clara's own use cases (design resolution #2d), captured here rather than left to propagate (topic `aaos.simulator.simulation.failed`). */
export interface SimulationFailed {
  readonly sessionId: string;
  readonly personaId: string;
  readonly turn: number;
  readonly reason: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
