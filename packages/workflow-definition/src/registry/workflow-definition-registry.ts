import {
  WORKFLOW_DEFINITION_STATUS_TRANSITIONS,
  WorkflowDefinitionStatus,
} from "../contracts/workflow-definition-status.js";
import { RegistryException } from "../errors/registry-exception.js";
import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

import type { IWorkflowDefinitionRegistry } from "./i-workflow-definition-registry.js";
import { VersionRegistry } from "./version-registry.js";
import type { WorkflowDefinitionEntry } from "./workflow-definition-entry.js";

function key(id: string, version: string): string {
  return `${id}@${version}`;
}

/** The only `IWorkflowDefinitionRegistry` implementation in this package — in-memory. */
export class WorkflowDefinitionRegistry implements IWorkflowDefinitionRegistry {
  private readonly entriesByKey = new Map<string, WorkflowDefinitionEntry>();
  private readonly versionRegistry = new VersionRegistry();

  register(
    workflow: WorkflowDefinition,
    status: WorkflowDefinitionStatus = WorkflowDefinitionStatus.DRAFT,
  ): WorkflowDefinitionEntry {
    const entryKey = key(workflow.id, workflow.version);
    if (this.entriesByKey.has(entryKey)) {
      throw new RegistryException(
        `Cannot register "${workflow.id}@${workflow.version}": already registered`,
      );
    }
    const now = new Date().toISOString();
    const entry: WorkflowDefinitionEntry = {
      workflow,
      status,
      registeredAt: now,
      updatedAt: now,
    };
    this.entriesByKey.set(entryKey, entry);
    this.versionRegistry.record(workflow.id, workflow.version);
    return entry;
  }

  get(id: string, version?: string): WorkflowDefinitionEntry | undefined {
    const resolvedVersion = version ?? this.versionRegistry.latest(id);
    if (!resolvedVersion) {
      return undefined;
    }
    return this.entriesByKey.get(key(id, resolvedVersion));
  }

  list(tenantId?: string): readonly WorkflowDefinitionEntry[] {
    const all = Array.from(this.entriesByKey.values());
    return tenantId === undefined
      ? all
      : all.filter((entry) => entry.workflow.tenantId === tenantId);
  }

  versions(id: string): readonly string[] {
    return this.versionRegistry.list(id);
  }

  remove(id: string, version: string): void {
    if (!this.entriesByKey.delete(key(id, version))) {
      throw new RegistryException(`Cannot remove "${id}@${version}": not registered`);
    }
    this.versionRegistry.remove(id, version);
  }

  setStatus(
    id: string,
    version: string,
    status: WorkflowDefinitionStatus,
  ): WorkflowDefinitionEntry {
    const entryKey = key(id, version);
    const existing = this.entriesByKey.get(entryKey);
    if (!existing) {
      throw new RegistryException(`Cannot change status of "${id}@${version}": not registered`);
    }
    if (!WORKFLOW_DEFINITION_STATUS_TRANSITIONS[existing.status].includes(status)) {
      throw new RegistryException(
        `Cannot transition "${id}@${version}" from "${existing.status}" to "${status}"`,
      );
    }
    const updated: WorkflowDefinitionEntry = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.entriesByKey.set(entryKey, updated);
    return updated;
  }
}
