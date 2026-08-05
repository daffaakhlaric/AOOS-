import type { WorkflowIntegrationContext } from "../context/workflow-integration-context.js";
import type { IntegrationNamespace } from "../contracts/integration-namespace.js";
import type { IntegrationRequest } from "../contracts/integration-request.js";
import type { IntegrationResult } from "../contracts/integration-result.js";

/** The mutable per-attempt state every Middleware stage sees and may update — `context`/`result` are reassigned in place (never replaced with a new object reference) so every stage observes the latest value. */
export interface WorkflowIntegrationMiddlewareContext {
  context: WorkflowIntegrationContext;
  readonly namespace: IntegrationNamespace;
  readonly request: IntegrationRequest;
  readonly metadata: Record<string, unknown>;
  result?: IntegrationResult;
}
