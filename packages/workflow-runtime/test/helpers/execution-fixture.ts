import type { WorkflowDefinition } from "@aos/workflow-definition";

import { createWorkflowContext } from "../../src/context/create-workflow-context.js";
import { createWorkflowInstance } from "../../src/instance/create-workflow-instance.js";
import { InstanceState } from "../../src/instance/instance-state.js";
import type { WorkflowExecution } from "../../src/instance/workflow-execution.js";

import { definitionFixture } from "./definition-fixture.js";

export function executionFixture(
  overrides: { readonly definition?: WorkflowDefinition; readonly status?: InstanceState } = {},
): WorkflowExecution {
  const definition = overrides.definition ?? definitionFixture();
  const instance = createWorkflowInstance({
    workflowId: definition.id,
    workflowVersion: definition.version,
  });
  const context = createWorkflowContext({ correlationId: instance.id });
  const status = overrides.status ?? InstanceState.CREATED;
  return {
    definition,
    instance: { ...instance, status },
    context: { ...context, currentState: status },
  };
}
