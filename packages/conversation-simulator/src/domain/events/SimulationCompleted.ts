/** Published once a session ends as `COMPLETED` or `TIMEOUT` (topic `aaos.simulator.simulation.completed`). */
export interface SimulationCompleted {
  readonly sessionId: string;
  readonly personaId: string;
  readonly status: string;
  readonly totalTurns: number;
  readonly finalScore: number;
  readonly finalTemperature: string;
  readonly metExpectation: boolean;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
