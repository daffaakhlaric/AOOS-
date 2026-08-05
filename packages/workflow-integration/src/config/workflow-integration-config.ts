import type { ITracer } from "@aos/event-bus";
import type { Logger } from "@aos/logger";

import type { IAuditSink } from "../middleware/i-audit-sink.js";
import type { IWorkflowIntegrationPermissionChecker } from "../middleware/i-workflow-integration-permission-checker.js";
import type { RetryPolicy } from "../retry/retry-policy.js";

export interface WorkflowIntegrationConfig {
  readonly permissionChecker?: IWorkflowIntegrationPermissionChecker;
  readonly tracer?: ITracer;
  readonly logger?: Logger;
  readonly auditSink?: IAuditSink;
  readonly retryPolicy?: RetryPolicy;
  readonly timeoutMs?: number;
  readonly requireTenantId?: boolean;
  readonly allowedEnvironments?: readonly string[];
  readonly allowedTenantIds?: readonly string[];
}
