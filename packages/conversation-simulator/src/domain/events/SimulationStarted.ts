/** Published the moment `SimulationRunnerService` begins a fresh session (topic `aaos.simulator.simulation.started`). */
export interface SimulationStarted {
  readonly sessionId: string;
  readonly personaId: string;
  readonly branchId: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}
