import type { ITracer } from "@aos/event-bus";
import type { Logger } from "@aos/logger";

import type { ICapabilityExecutor } from "../capability/i-capability-executor.js";
import type { ICompensationManager } from "../compensation/i-compensation-manager.js";
import type { ExecutionMode } from "../context/execution-mode.js";
import type { ExecutionTimeouts } from "../context/execution-timeouts.js";
import type { IExecutionPermissionChecker } from "../middleware/i-execution-permission-checker.js";
import type { RetryPolicy } from "../retry/retry-policy.js";

export interface WorkflowExecutionConfig {
  /** Defaults to `ExecutionMode.SEQUENTIAL` when `executeWorkflow()` doesn't specify one. */
  readonly defaultMode?: ExecutionMode;
  readonly permissionChecker?: IExecutionPermissionChecker;
  readonly tracer?: ITracer;
  readonly logger?: Logger;
  /** "Implementation belongs to 005.9" — omitted means every Capability Node fails with `CapabilityNotConfiguredException`. */
  readonly capabilityExecutor?: ICapabilityExecutor;
  /** Interface-only extension point — never invoked by this package's engine today. */
  readonly compensationManager?: ICompensationManager;
  readonly retryPolicy?: RetryPolicy;
  readonly timeouts?: ExecutionTimeouts;
  /** Bounds a Loop Node's body re-entry when no Expression Evaluator is configured (none exists in this package). Defaults to `1`. */
  readonly maxLoopIterations?: number;
}

export const DEFAULT_MAX_LOOP_ITERATIONS = 1;
