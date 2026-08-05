import type { WorkflowDefinitionStatus } from "../contracts/workflow-definition-status.js";
import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

import type { WorkflowDefinitionEntry } from "./workflow-definition-entry.js";

/** Workflow Definition Registry port (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "REGISTRY"). In-memory only — no persistence ships in this package. */
export interface IWorkflowDefinitionRegistry {
  register(
    workflow: WorkflowDefinition,
    status?: WorkflowDefinitionStatus,
  ): WorkflowDefinitionEntry;
  /** Omitting `version` resolves to the latest registered version for `id`. */
  get(id: string, version?: string): WorkflowDefinitionEntry | undefined;
  list(tenantId?: string): readonly WorkflowDefinitionEntry[];
  versions(id: string): readonly string[];
  remove(id: string, version: string): void;
  setStatus(id: string, version: string, status: WorkflowDefinitionStatus): WorkflowDefinitionEntry;
}
