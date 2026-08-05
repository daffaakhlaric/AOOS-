import type { ITracer } from "@aos/event-bus";

import type { IKnowledgeRuntimeReplay } from "../contracts/i-knowledge-runtime-replay.js";
import type { IKnowledgeRuntimePermissionChecker } from "../middleware/i-permission-checker.js";
import type { IKnowledgeRuntimePolicyChecker } from "../middleware/i-policy-checker.js";
import type { IKnowledgeRuntimeLogger } from "../middleware/i-runtime-logger.js";

export interface KnowledgeRuntimeConfig {
  readonly allowedTenantIds?: readonly string[];
  readonly allowedWorkspaceIds?: readonly string[];
  readonly permissionChecker?: IKnowledgeRuntimePermissionChecker;
  readonly policyChecker?: IKnowledgeRuntimePolicyChecker;
  readonly tracer?: ITracer;
  readonly logger?: IKnowledgeRuntimeLogger;
  readonly replayProvider?: IKnowledgeRuntimeReplay;
  readonly defaultSessionTtlMs?: number;
}
