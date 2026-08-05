import type { ExecutionSession } from "../engine/execution-session.js";

/**
 * "COMPENSATION: Support interface only. CompensationManager, CompensationAction,
 * RollbackAction, RecoveryAction." (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md).
 * No class in this package implements any of these.
 */
export interface CompensationAction {
  readonly nodeId: string;
  compensate(session: ExecutionSession): Promise<void>;
}

export interface RollbackAction {
  readonly nodeId: string;
  rollback(session: ExecutionSession): Promise<void>;
}

export interface RecoveryAction {
  readonly nodeId: string;
  recover(session: ExecutionSession): Promise<void>;
}

export interface ICompensationManager {
  registerCompensation(action: CompensationAction): void;
  registerRollback(action: RollbackAction): void;
  registerRecovery(action: RecoveryAction): void;
  compensate(session: ExecutionSession): Promise<void>;
}
