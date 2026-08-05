import type { CompatibilityResult, WorkflowDefinition } from "@aos/workflow-definition";

export interface IWorkflowLoader {
  /** Loads the latest registered version for `id` — equivalent to `loadLatest(id)`. */
  loadById(id: string): WorkflowDefinition;
  /** Loads exactly `version` of `id`. */
  loadByVersion(id: string, version: string): WorkflowDefinition;
  /** Loads the latest registered version for `id`. */
  loadLatest(id: string): WorkflowDefinition;
  /** Lists every version registered for `id` (delegates to the read-only Definition Registry's Version Registry). */
  loadRegisteredVersions(id: string): readonly string[];
  /** Runs `@aos/workflow-definition`'s `CompatibilityChecker` between two versions of the same Workflow id. */
  validateCompatibility(id: string, fromVersion: string, toVersion: string): CompatibilityResult;
}
