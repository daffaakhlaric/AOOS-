import { IntegrationNamespace } from "../../src/contracts/integration-namespace.js";
import type { WorkflowIntegrationMiddlewareContext } from "../../src/middleware/workflow-integration-middleware-context.js";

import { contextFixture } from "./context-fixture.js";

export function middlewareContextFixture(
  overrides: Partial<Omit<WorkflowIntegrationMiddlewareContext, "metadata">> = {},
): WorkflowIntegrationMiddlewareContext {
  return {
    context: overrides.context ?? contextFixture(),
    namespace: overrides.namespace ?? IntegrationNamespace.CAPABILITY,
    request: overrides.request ?? { operation: "create", input: {} },
    metadata: {},
    result: overrides.result,
  };
}
