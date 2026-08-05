import type { WorkflowIntegrationMiddlewareContext } from "./workflow-integration-middleware-context.js";

export type WorkflowIntegrationMiddlewareNext = () => Promise<void>;

/** "MIDDLEWARE PIPELINE: Validation, Permission, Tracing, Metrics, Tenant, Environment, Retry, Timeout, Logging, Audit. Extensible." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md). */
export interface IWorkflowIntegrationMiddleware {
  readonly name: string;
  execute(
    context: WorkflowIntegrationMiddlewareContext,
    next: WorkflowIntegrationMiddlewareNext,
  ): Promise<void>;
}
