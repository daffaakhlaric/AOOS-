import type { ITracer } from "@aos/event-bus";

import { ExecutionMode } from "../context/execution-mode.js";
import type { IPermissionChecker } from "../middleware/i-permission-checker.js";
import type { IWorkflowReplay } from "../replay-interface/i-workflow-replay.js";

export interface WorkflowRuntimeConfig {
  /** Defaults to `ExecutionMode.NORMAL` when a `createInstance()` call doesn't specify one. */
  readonly defaultExecutionMode?: ExecutionMode;
  /** Optional finer-grained Permission check beyond Tenant Isolation — see `middleware/i-permission-checker.ts`. */
  readonly permissionChecker?: IPermissionChecker;
  /** Optional Tracer — defaults to `@aos/event-bus`'s `InMemoryTracer` when omitted. */
  readonly tracer?: ITracer;
  /** Optional Replay provider — `replay()` throws `ReplayNotSupportedException` when omitted (interface-only integration point). */
  readonly replayProvider?: IWorkflowReplay;
}

export const DEFAULT_EXECUTION_MODE = ExecutionMode.NORMAL;
