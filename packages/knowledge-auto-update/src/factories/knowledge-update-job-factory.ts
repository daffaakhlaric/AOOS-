import { KnowledgeUpdateJob } from "../entities/knowledge-update-job.js";
import type { Metadata } from "../types/common.js";
import { KnowledgeUpdateJobStatus } from "../types/job-status.js";
import { ScheduleKind, type ScheduleDescriptor } from "../types/schedule-descriptor.js";
import { KnowledgeUpdateType } from "../types/update-type.js";
import { generateId } from "../utils/id-generator.js";

export interface CreateJobInput {
  readonly updateType?: KnowledgeUpdateType;
  readonly targetId: string;
  readonly schedule?: ScheduleDescriptor;
  readonly policyId: string;
  readonly dependsOn?: readonly string[];
  readonly payload?: Metadata;
  readonly priority?: number;
}

/** Real Factory-pattern class building `KnowledgeUpdateJob` instances with sensible defaults. */
export class KnowledgeUpdateJobFactory {
  create(input: CreateJobInput, now: number): KnowledgeUpdateJob {
    return new KnowledgeUpdateJob({
      id: generateId("job"),
      updateType: input.updateType ?? KnowledgeUpdateType.Manual,
      targetId: input.targetId,
      schedule: input.schedule ?? { kind: ScheduleKind.Immediate },
      policyId: input.policyId,
      status: KnowledgeUpdateJobStatus.Pending,
      priority: input.priority ?? 0,
      dependsOn: input.dependsOn ?? [],
      attempt: 0,
      nextRunAt: undefined,
      payload: input.payload ?? {},
      previousPayload: undefined,
      createdAt: now,
      updatedAt: now,
    });
  }
}
