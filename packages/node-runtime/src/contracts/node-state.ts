/** The full Node lifecycle (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md — "NODE STATE"). */
export enum NodeState {
  CREATED = "created",
  READY = "ready",
  RUNNING = "running",
  WAITING = "waiting",
  PAUSED = "paused",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  SKIPPED = "skipped",
  TIMED_OUT = "timed_out",
  COMPENSATED = "compensated",
}

/** The authoritative transition table — `lifecycle/node-state-machine.ts` is the only code allowed to consult this to decide whether a transition is legal. */
export const NODE_STATE_TRANSITIONS: Readonly<Record<NodeState, readonly NodeState[]>> = {
  [NodeState.CREATED]: [NodeState.READY, NodeState.CANCELLED],
  [NodeState.READY]: [
    NodeState.RUNNING,
    NodeState.SKIPPED,
    NodeState.CANCELLED,
    NodeState.TIMED_OUT,
  ],
  [NodeState.RUNNING]: [
    NodeState.WAITING,
    NodeState.PAUSED,
    NodeState.COMPLETED,
    NodeState.FAILED,
    NodeState.CANCELLED,
    NodeState.TIMED_OUT,
  ],
  [NodeState.WAITING]: [
    NodeState.RUNNING,
    NodeState.PAUSED,
    NodeState.CANCELLED,
    NodeState.TIMED_OUT,
    NodeState.FAILED,
  ],
  [NodeState.PAUSED]: [NodeState.RUNNING, NodeState.CANCELLED, NodeState.TIMED_OUT],
  [NodeState.FAILED]: [NodeState.COMPENSATED],
  [NodeState.COMPLETED]: [],
  [NodeState.CANCELLED]: [],
  [NodeState.SKIPPED]: [],
  [NodeState.TIMED_OUT]: [],
  [NodeState.COMPENSATED]: [],
};

/** States metrics/health classify as "no longer actively executing" — `FAILED` is included even though it may still transition to `COMPENSATED`. */
export const TERMINAL_NODE_STATES: ReadonlySet<NodeState> = new Set([
  NodeState.COMPLETED,
  NodeState.FAILED,
  NodeState.CANCELLED,
  NodeState.SKIPPED,
  NodeState.TIMED_OUT,
  NodeState.COMPENSATED,
]);
