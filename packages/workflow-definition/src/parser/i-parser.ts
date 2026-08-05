import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

/** Parser port — YAML and JSON ship in this package (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "SERIALIZATION"). A BPMN Import Adapter is future work. */
export interface IWorkflowDefinitionParser {
  readonly format: string;
  parse(source: string): WorkflowDefinition;
}
