import {
  WorkflowDefinitionRegistry,
  WorkflowDefinitionStatus,
  type WorkflowDefinition,
} from "@aos/workflow-definition";
import { WorkflowRuntime, WorkflowRuntimeEventPublisher } from "@aos/workflow-runtime";

import { fakePublisher } from "./publisher-fixture.js";

/** A real `WorkflowRuntime` (from `@aos/workflow-runtime`) pre-registered with `definitions`. */
export function workflowRuntimeFixture(
  definitions: readonly WorkflowDefinition[],
): WorkflowRuntime {
  const registry = new WorkflowDefinitionRegistry();
  for (const definition of definitions) {
    registry.register(definition, WorkflowDefinitionStatus.PUBLISHED);
  }
  const { publisher } = fakePublisher();
  return new WorkflowRuntime({
    definitionRegistry: registry,
    eventPublisher: new WorkflowRuntimeEventPublisher(publisher),
  });
}
