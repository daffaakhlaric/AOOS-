import {
  CompatibilityChecker,
  type CompatibilityResult,
  type IWorkflowDefinitionRegistry,
  type WorkflowDefinition,
} from "@aos/workflow-definition";

import { WorkflowNotFoundException } from "../errors/workflow-not-found-exception.js";

import type { IWorkflowLoader } from "./i-workflow-loader.js";

/**
 * Loads Workflow Definitions from the (read-only) `IWorkflowDefinitionRegistry` — this
 * package never writes to that Registry, only `get()`/`versions()` against it.
 */
export class WorkflowLoader implements IWorkflowLoader {
  private readonly compatibilityChecker = new CompatibilityChecker();

  constructor(private readonly registry: IWorkflowDefinitionRegistry) {}

  loadById(id: string): WorkflowDefinition {
    return this.loadLatest(id);
  }

  loadByVersion(id: string, version: string): WorkflowDefinition {
    const entry = this.registry.get(id, version);
    if (!entry) {
      throw new WorkflowNotFoundException(
        `Workflow Definition "${id}@${version}" is not registered`,
      );
    }
    return entry.workflow;
  }

  loadLatest(id: string): WorkflowDefinition {
    const entry = this.registry.get(id);
    if (!entry) {
      throw new WorkflowNotFoundException(`Workflow Definition "${id}" has no registered version`);
    }
    return entry.workflow;
  }

  loadRegisteredVersions(id: string): readonly string[] {
    return this.registry.versions(id);
  }

  validateCompatibility(id: string, fromVersion: string, toVersion: string): CompatibilityResult {
    const previous = this.loadByVersion(id, fromVersion);
    const next = this.loadByVersion(id, toVersion);
    return this.compatibilityChecker.check(previous, next);
  }
}
