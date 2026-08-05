import type { WorkflowIntegrationContext } from "../context/workflow-integration-context.js";
import type { IntegrationNamespace } from "../contracts/integration-namespace.js";

/** The same extension-point pattern used by every prior AOS runtime package's own Permission middleware. */
export interface IWorkflowIntegrationPermissionChecker {
  check(
    context: WorkflowIntegrationContext,
    namespace: IntegrationNamespace,
  ): boolean | Promise<boolean>;
}
