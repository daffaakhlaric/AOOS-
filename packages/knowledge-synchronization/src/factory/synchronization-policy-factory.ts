import type { KnowledgeSynchronizationMode } from "../domain/knowledge-synchronization-mode.js";
import type { KnowledgeSynchronizationPolicyRecord } from "../policy/knowledge-synchronization-policy-record.js";
import { generateId } from "../utils/id.js";

export interface CreateSynchronizationPolicyInput {
  readonly name: string;
  readonly tenantId: string;
  readonly workspaceId?: string;
  readonly enabled?: boolean;
  readonly allowedModes?: readonly KnowledgeSynchronizationMode[];
  readonly deniedModes?: readonly KnowledgeSynchronizationMode[];
}

/** Builds a fresh `KnowledgeSynchronizationPolicyRecord`. */
export class SynchronizationPolicyFactory {
  create(input: CreateSynchronizationPolicyInput): KnowledgeSynchronizationPolicyRecord {
    return {
      id: generateId(),
      name: input.name,
      scope: { tenantId: input.tenantId, workspaceId: input.workspaceId },
      enabled: input.enabled ?? true,
      allowedModes: input.allowedModes ? [...input.allowedModes] : undefined,
      deniedModes: input.deniedModes ? [...input.deniedModes] : undefined,
      createdAt: new Date().toISOString(),
    };
  }
}
