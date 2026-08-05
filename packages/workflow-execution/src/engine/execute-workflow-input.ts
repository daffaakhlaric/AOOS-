import type { ExecutionMode } from "../context/execution-mode.js";

export interface ExecuteWorkflowInput {
  readonly workflowId: string;
  readonly workflowVersion?: string;
  readonly tenantId?: string;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly workflowVariables?: Readonly<Record<string, unknown>>;
  readonly environmentVariables?: Readonly<Record<string, unknown>>;
  readonly input?: Readonly<Record<string, unknown>>;
  readonly mode?: ExecutionMode;
}
