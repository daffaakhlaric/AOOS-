import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

import type { IWorkflowDefinitionSerializer } from "./i-serializer.js";

/** Serializes a Workflow Definition to pretty-printed JSON — the exact inverse of `JsonWorkflowDefinitionParser`. */
export class JsonWorkflowDefinitionSerializer implements IWorkflowDefinitionSerializer {
  readonly format = "json";

  serialize(workflow: WorkflowDefinition): string {
    return JSON.stringify(workflow, null, 2);
  }
}
