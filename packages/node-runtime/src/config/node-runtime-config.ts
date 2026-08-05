import type { ITracer } from "@aos/event-bus";
import type { Logger } from "@aos/logger";

import { ExecutionMode } from "../contracts/execution-mode.js";
import type { NodeManifest } from "../contracts/node-manifest.js";
import type { INodePermissionChecker } from "../middleware/i-node-permission-checker.js";

export interface NodeRuntimeConfig {
  /** Defaults to `ExecutionMode.NORMAL` when a `createInstance()` call doesn't specify one. */
  readonly defaultExecutionMode?: ExecutionMode;
  /** Optional finer-grained Permission check — see `middleware/i-node-permission-checker.ts`. */
  readonly permissionChecker?: INodePermissionChecker;
  /** Optional Tracer — defaults to `@aos/event-bus`'s `InMemoryTracer` when omitted. */
  readonly tracer?: ITracer;
  /** Optional Logger — defaults to `@aos/logger`'s `createLogger({ serviceName: "node-runtime" })` when omitted. */
  readonly logger?: Logger;
  /** Overrides the built-in `ALL_NODE_MANIFESTS` catalog — primarily for tests and Solution Packs registering custom Node Types. */
  readonly manifests?: readonly NodeManifest[];
}

export const DEFAULT_EXECUTION_MODE = ExecutionMode.NORMAL;
