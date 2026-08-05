/** Every Workflow Definition change publishes one of these onto the Event Bus (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "EVENTS"). */
export enum WorkflowDefinitionEventType {
  CREATED = "workflow.definition.created",
  UPDATED = "workflow.definition.updated",
  DELETED = "workflow.definition.deleted",
  VALIDATED = "workflow.definition.validated",
  VERSIONED = "workflow.definition.versioned",
}
