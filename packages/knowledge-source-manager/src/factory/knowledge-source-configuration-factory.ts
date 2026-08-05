import type { KnowledgeSourceConfigurationRecord } from "../configuration/knowledge-source-configuration-record.js";
import type { KnowledgeSourceScheduleDescriptor } from "../scheduler/knowledge-source-schedule-descriptor.js";
import { KnowledgeSourceScheduleMode } from "../scheduler/knowledge-source-schedule-mode.js";

export interface CreateKnowledgeSourceConfigurationInput {
  readonly sourceId: string;
  readonly schedule?: KnowledgeSourceScheduleDescriptor;
  readonly namespace?: string;
  readonly collection?: string;
  readonly policy?: string;
  readonly permission?: string;
  readonly priority?: number;
  readonly syncMode?: KnowledgeSourceScheduleMode;
  readonly enabled?: boolean;
  readonly autoSync?: boolean;
  readonly incremental?: boolean;
  readonly versioning?: boolean;
  readonly retentionDays?: number;
}

/** Builds a fresh `KnowledgeSourceConfigurationRecord` defaulting to Manual/disabled — the safest starting point for a newly created Source. */
export class KnowledgeSourceConfigurationFactory {
  create(input: CreateKnowledgeSourceConfigurationInput): KnowledgeSourceConfigurationRecord {
    return {
      sourceId: input.sourceId,
      schedule: input.schedule,
      namespace: input.namespace,
      collection: input.collection,
      policy: input.policy,
      permission: input.permission,
      priority: input.priority ?? 0,
      syncMode: input.syncMode ?? KnowledgeSourceScheduleMode.MANUAL,
      enabled: input.enabled ?? false,
      autoSync: input.autoSync ?? false,
      incremental: input.incremental ?? false,
      versioning: input.versioning ?? false,
      retentionDays: input.retentionDays,
    };
  }
}
