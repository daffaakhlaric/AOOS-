import type { WorkflowExecution } from "../instance/workflow-execution.js";

/**
 * "Compensation. Implement interfaces only. No execution." (docs/PROMPT-005.6B-WORKFLOW-RUNTIME-CORE.md).
 * No class in this package implements or invokes these — they declare the extension point
 * a future Node/Execution Runtime (005.6C/005.6D) would use to run a Node's
 * `CompensationConfig` (`@aos/workflow-definition`) when an Instance enters
 * `InstanceState.COMPENSATING`.
 */
export interface ICompensationHandler {
  readonly nodeId: string;
  compensate(execution: WorkflowExecution): Promise<void>;
}

export interface ICompensationCoordinator {
  register(handler: ICompensationHandler): void;
  resolve(nodeId: string): ICompensationHandler | undefined;
}
