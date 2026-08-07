import { KnowledgeUpdateJob } from "../../src/entities/knowledge-update-job.js";
import { KnowledgeUpdatePolicyFactory } from "../../src/factories/knowledge-update-policy-factory.js";
import { ConflictResolutionStrategyName } from "../../src/types/conflict-resolution-strategy.js";
import { KnowledgeUpdateJobStatus } from "../../src/types/job-status.js";
import { ScheduleKind, type ScheduleDescriptor } from "../../src/types/schedule-descriptor.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { resetIdCounters } from "../../src/utils/id-generator.js";
import type { KnowledgeUpdatePolicy } from "../../src/value-objects/knowledge-update-policy.js";

export function resetFixtureState(): void {
  resetIdCounters();
}

export function makePolicy(
  overrides: Partial<Parameters<KnowledgeUpdatePolicyFactory["create"]>[0]> = {},
): KnowledgeUpdatePolicy {
  return new KnowledgeUpdatePolicyFactory().create({ name: "test-policy", ...overrides });
}

export interface MakeJobOptions {
  readonly id?: string;
  readonly updateType?: KnowledgeUpdateType;
  readonly targetId?: string;
  readonly schedule?: ScheduleDescriptor;
  readonly policyId?: string;
  readonly status?: KnowledgeUpdateJobStatus;
  readonly priority?: number;
  readonly dependsOn?: readonly string[];
  readonly attempt?: number;
  readonly nextRunAt?: number;
  readonly payload?: Record<string, unknown>;
  readonly previousPayload?: Record<string, unknown>;
  readonly createdAt?: number;
  readonly updatedAt?: number;
}

let jobCounter = 0;

export function makeJob(options: MakeJobOptions = {}): KnowledgeUpdateJob {
  jobCounter += 1;
  return new KnowledgeUpdateJob({
    id: options.id ?? `fixture-job-${jobCounter}`,
    updateType: options.updateType ?? KnowledgeUpdateType.Manual,
    targetId: options.targetId ?? "target-1",
    schedule: options.schedule ?? { kind: ScheduleKind.Immediate },
    policyId: options.policyId ?? "policy-1",
    status: options.status ?? KnowledgeUpdateJobStatus.Pending,
    priority: options.priority ?? 0,
    dependsOn: options.dependsOn ?? [],
    attempt: options.attempt ?? 0,
    nextRunAt: options.nextRunAt,
    payload: options.payload ?? {},
    previousPayload: options.previousPayload,
    createdAt: options.createdAt ?? 0,
    updatedAt: options.updatedAt ?? 0,
  });
}

export const defaultConflictStrategy = ConflictResolutionStrategyName.LastWriteWins;
