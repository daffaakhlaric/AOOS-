/** The full Workflow Instance lifecycle (docs/PROMPT-005.6B-WORKFLOW-RUNTIME-CORE.md — "INSTANCE STATE"). */
export enum InstanceState {
  CREATED = "created",
  READY = "ready",
  RUNNING = "running",
  WAITING = "waiting",
  PAUSED = "paused",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  FAILED = "failed",
  COMPENSATING = "compensating",
  COMPENSATED = "compensated",
  EXPIRED = "expired",
}

/** The authoritative transition table — `state-machine/workflow-state-machine.ts` is the only code allowed to consult this to decide whether a transition is legal. */
export const INSTANCE_STATE_TRANSITIONS: Readonly<Record<InstanceState, readonly InstanceState[]>> =
  {
    [InstanceState.CREATED]: [InstanceState.READY, InstanceState.CANCELLED],
    [InstanceState.READY]: [InstanceState.RUNNING, InstanceState.CANCELLED, InstanceState.EXPIRED],
    [InstanceState.RUNNING]: [
      InstanceState.WAITING,
      InstanceState.PAUSED,
      InstanceState.COMPLETED,
      InstanceState.FAILED,
      InstanceState.CANCELLED,
    ],
    [InstanceState.WAITING]: [
      InstanceState.RUNNING,
      InstanceState.PAUSED,
      InstanceState.CANCELLED,
      InstanceState.EXPIRED,
      InstanceState.FAILED,
    ],
    [InstanceState.PAUSED]: [InstanceState.RUNNING, InstanceState.CANCELLED, InstanceState.EXPIRED],
    [InstanceState.FAILED]: [InstanceState.COMPENSATING],
    [InstanceState.COMPENSATING]: [InstanceState.COMPENSATED, InstanceState.FAILED],
    [InstanceState.COMPENSATED]: [],
    [InstanceState.COMPLETED]: [],
    [InstanceState.CANCELLED]: [],
    [InstanceState.EXPIRED]: [],
  };

/**
 * States metrics/health classify as "no longer actively executing" — note `FAILED` is
 * included here even though `INSTANCE_STATE_TRANSITIONS` still allows `FAILED →
 * COMPENSATING`; this set is a metrics/health categorization, not a state-machine rule.
 */
export const TERMINAL_INSTANCE_STATES: ReadonlySet<InstanceState> = new Set([
  InstanceState.COMPLETED,
  InstanceState.CANCELLED,
  InstanceState.FAILED,
  InstanceState.COMPENSATED,
  InstanceState.EXPIRED,
]);
