/** The full Execution Session lifecycle (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md — "STATE MACHINE"). */
export enum ExecutionState {
  CREATED = "created",
  READY = "ready",
  RUNNING = "running",
  WAITING = "waiting",
  RETRYING = "retrying",
  PAUSED = "paused",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  TIMEOUT = "timeout",
  COMPENSATING = "compensating",
}

/** The authoritative transition table — `state-machine/execution-state-machine.ts` is the only code allowed to consult this to decide whether a transition is legal. */
export const EXECUTION_STATE_TRANSITIONS: Readonly<
  Record<ExecutionState, readonly ExecutionState[]>
> = {
  [ExecutionState.CREATED]: [ExecutionState.READY, ExecutionState.CANCELLED],
  [ExecutionState.READY]: [
    ExecutionState.RUNNING,
    ExecutionState.CANCELLED,
    ExecutionState.TIMEOUT,
  ],
  [ExecutionState.RUNNING]: [
    ExecutionState.WAITING,
    ExecutionState.PAUSED,
    ExecutionState.RETRYING,
    ExecutionState.COMPLETED,
    ExecutionState.FAILED,
    ExecutionState.CANCELLED,
    ExecutionState.TIMEOUT,
  ],
  [ExecutionState.WAITING]: [
    ExecutionState.RUNNING,
    ExecutionState.PAUSED,
    ExecutionState.CANCELLED,
    ExecutionState.TIMEOUT,
    ExecutionState.FAILED,
  ],
  [ExecutionState.RETRYING]: [
    ExecutionState.RUNNING,
    ExecutionState.FAILED,
    ExecutionState.CANCELLED,
  ],
  [ExecutionState.PAUSED]: [
    ExecutionState.RUNNING,
    ExecutionState.CANCELLED,
    ExecutionState.TIMEOUT,
  ],
  [ExecutionState.FAILED]: [ExecutionState.COMPENSATING],
  [ExecutionState.COMPLETED]: [],
  [ExecutionState.CANCELLED]: [],
  [ExecutionState.TIMEOUT]: [],
  [ExecutionState.COMPENSATING]: [],
};

/** States metrics/health classify as "no longer actively executing" — `FAILED` is included even though it may still transition to `COMPENSATING`. */
export const TERMINAL_EXECUTION_STATES: ReadonlySet<ExecutionState> = new Set([
  ExecutionState.COMPLETED,
  ExecutionState.FAILED,
  ExecutionState.CANCELLED,
  ExecutionState.TIMEOUT,
  ExecutionState.COMPENSATING,
]);
