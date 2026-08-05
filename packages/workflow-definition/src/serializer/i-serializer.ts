import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

/** Serializer port — YAML and JSON ship in this package. */
export interface IWorkflowDefinitionSerializer {
  readonly format: string;
  serialize(workflow: WorkflowDefinition): string;
}
