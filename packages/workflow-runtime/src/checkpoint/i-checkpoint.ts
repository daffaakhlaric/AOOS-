/**
 * "Checkpoint interface. No persistence." (docs/PROMPT-005.6B-WORKFLOW-RUNTIME-CORE.md —
 * "SNAPSHOT"). Interface only — no implementing class exists in this package. A
 * Checkpoint is finer-grained than a `WorkflowSnapshot`: an arbitrary data capture a
 * future Node Runtime (005.6C) could record mid-Node-execution, keyed by Node id rather
 * than by Instance-wide state.
 */
export interface ICheckpoint {
  readonly id: string;
  readonly instanceToken: string;
  readonly nodeId: string;
  readonly sequence: number;
  readonly createdAt: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface ICheckpointStore {
  save(checkpoint: ICheckpoint): Promise<void>;
  load(instanceToken: string): Promise<readonly ICheckpoint[]>;
}
