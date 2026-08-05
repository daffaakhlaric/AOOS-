import type { NodeExecution } from "../instance/node-execution.js";

export interface INodeLifecycleManager {
  initialize(execution: NodeExecution): NodeExecution;
  validate(execution: NodeExecution): NodeExecution;
  prepare(execution: NodeExecution): NodeExecution;
  start(execution: NodeExecution): NodeExecution;
  pause(execution: NodeExecution, reason?: string): NodeExecution;
  resume(execution: NodeExecution): NodeExecution;
  complete(execution: NodeExecution): NodeExecution;
  fail(execution: NodeExecution, reason?: string): NodeExecution;
  cancel(execution: NodeExecution, reason?: string): NodeExecution;
  timeout(execution: NodeExecution): NodeExecution;
}

/**
 * "Compensate (interface only)" (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md —
 * "NODE LIFECYCLE"). No class in this package implements this.
 */
export interface INodeCompensatable {
  compensate(execution: NodeExecution): Promise<NodeExecution>;
}
