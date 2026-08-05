/** A point-in-time capture this package could hand to a Checkpoint store — mirrors `@aos/workflow-execution`'s own `ICheckpointStore` shape, kept independent since this package captures Integration state, not Execution state. */
export interface IntegrationCheckpoint {
  readonly id: string;
  readonly workflowExecutionId: string;
  readonly sequence: number;
  readonly createdAt: string;
  readonly snapshot: Readonly<Record<string, unknown>>;
}

/** "Checkpoint Provider — No implementation." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md — "FUTURE READY"). */
export interface ICheckpointProvider {
  save(checkpoint: IntegrationCheckpoint): Promise<void>;
  get(id: string): Promise<IntegrationCheckpoint | undefined>;
  list(workflowExecutionId: string): Promise<readonly IntegrationCheckpoint[]>;
}
