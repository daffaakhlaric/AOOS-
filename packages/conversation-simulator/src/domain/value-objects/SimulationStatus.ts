/**
 * A simulation's lifecycle state (spec "domain/value-objects/SimulationStatus.ts").
 *
 * End-condition priority order (design resolution #2): a session starts `RUNNING`, then becomes,
 * in this priority order — (a) `COMPLETED` the instant `HandoffTriggered` fires for the current
 * turn, even if the persona's script has remaining lines; (b) `COMPLETED` when the persona's
 * script is exhausted with no handoff; (c) `TIMEOUT` when `maxTurnsPerSimulation` is reached
 * without handoff or script exhaustion; (d) any thrown/unexpected error, or an unexpected `err`
 * `Result` from Clara's own use case, is captured in `RunSimulation`'s `Result` err channel
 * (never thrown out of `RunSimulation`) — `FAILED` is what `RunAllScenarios` synthesizes into its
 * per-persona result when that happens, so a single persona's failure never aborts the batch.
 */
export enum SimulationStatus {
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  TIMEOUT = "TIMEOUT",
}

export const ALL_SIMULATION_STATUSES: ReadonlyArray<SimulationStatus> = [
  SimulationStatus.RUNNING,
  SimulationStatus.COMPLETED,
  SimulationStatus.FAILED,
  SimulationStatus.TIMEOUT,
];
