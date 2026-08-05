import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

/**
 * Migration Interface (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md —
 * "VERSIONING"). Interface only — no concrete migration ships in this package (there is
 * no prior AOS-WDL version to migrate from yet). Mirrors `@aos/registry`'s
 * `IMigrationHook` pattern: a future consumer implements this to transform a Workflow
 * Definition across a breaking version change.
 */
export interface IWorkflowMigration {
  readonly fromVersion: string;
  readonly toVersion: string;
  migrate(workflow: WorkflowDefinition): WorkflowDefinition;
}
