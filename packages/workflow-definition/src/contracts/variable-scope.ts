/** Variable scopes (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "VARIABLES"). */
export enum VariableScope {
  WORKFLOW = "workflow",
  NODE = "node",
  GLOBAL = "global",
  TEMPORARY = "temporary",
  ENVIRONMENT = "environment",
}
