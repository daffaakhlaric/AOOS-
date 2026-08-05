import type { ExecutionContext } from "../context/execution-context.js";

/**
 * "CAPABILITY EXECUTION: Execution Engine MUST NEVER know implementation. Only define
 * interface... Implementation belongs to 005.9." (docs/PROMPT-005.6D-WORKFLOW-EXECUTION-ENGINE.md).
 * No class in this package implements this — `engine/workflow-execution-engine.ts` accepts
 * an optional `ICapabilityExecutor` via configuration and throws
 * `CapabilityNotConfiguredException` when a Capability Node must run and none was supplied.
 */
export interface CapabilityExecutionRequest {
  readonly capabilityId: string;
  readonly capabilityVersion?: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly context: ExecutionContext;
}

export interface CapabilityExecutionResult {
  readonly success: boolean;
  readonly output?: Readonly<Record<string, unknown>>;
  readonly error?: string;
}

export interface ICapabilityExecutor {
  execute(request: CapabilityExecutionRequest): Promise<CapabilityExecutionResult>;
  validate(request: CapabilityExecutionRequest): Promise<boolean>;
  cancel(capabilityId: string): Promise<void>;
}
