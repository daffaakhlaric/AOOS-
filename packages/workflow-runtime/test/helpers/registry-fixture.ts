import {
  WorkflowDefinitionRegistry,
  WorkflowDefinitionStatus,
  type WorkflowDefinition,
} from "@aos/workflow-definition";

/** A real `WorkflowDefinitionRegistry` (from `@aos/workflow-definition`) pre-registered with `definitions`, each set `PUBLISHED`. */
export function registryFixture(
  definitions: readonly WorkflowDefinition[],
): WorkflowDefinitionRegistry {
  const registry = new WorkflowDefinitionRegistry();
  for (const definition of definitions) {
    registry.register(definition, WorkflowDefinitionStatus.PUBLISHED);
  }
  return registry;
}
