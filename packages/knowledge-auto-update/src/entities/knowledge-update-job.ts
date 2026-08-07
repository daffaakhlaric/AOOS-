import type { Metadata } from "../types/common.js";
import type { KnowledgeUpdateJobStatus } from "../types/job-status.js";
import type { ScheduleDescriptor } from "../types/schedule-descriptor.js";
import type { KnowledgeUpdateType } from "../types/update-type.js";

export interface KnowledgeUpdateJobProps {
  readonly id: string;
  readonly updateType: KnowledgeUpdateType;
  readonly targetId: string;
  readonly schedule: ScheduleDescriptor;
  readonly policyId: string;
  readonly status: KnowledgeUpdateJobStatus;
  readonly priority: number;
  readonly dependsOn: readonly string[];
  readonly attempt: number;
  readonly nextRunAt: number | undefined;
  readonly payload: Metadata;
  readonly previousPayload: Metadata | undefined;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * Immutable job aggregate. Every "mutation" (`with*`) returns a new `KnowledgeUpdateJob` instance
 * with `updatedAt` refreshed — nothing is ever mutated in place.
 */
export class KnowledgeUpdateJob {
  readonly id: string;
  readonly updateType: KnowledgeUpdateType;
  readonly targetId: string;
  readonly schedule: ScheduleDescriptor;
  readonly policyId: string;
  readonly status: KnowledgeUpdateJobStatus;
  readonly priority: number;
  readonly dependsOn: readonly string[];
  readonly attempt: number;
  readonly nextRunAt: number | undefined;
  readonly payload: Metadata;
  readonly previousPayload: Metadata | undefined;
  readonly createdAt: number;
  readonly updatedAt: number;

  constructor(props: KnowledgeUpdateJobProps) {
    if (props.id.trim().length === 0) {
      throw new RangeError("KnowledgeUpdateJob: id must not be empty");
    }
    if (props.attempt < 0) {
      throw new RangeError("KnowledgeUpdateJob: attempt must be >= 0");
    }
    this.id = props.id;
    this.updateType = props.updateType;
    this.targetId = props.targetId;
    this.schedule = props.schedule;
    this.policyId = props.policyId;
    this.status = props.status;
    this.priority = props.priority;
    this.dependsOn = props.dependsOn;
    this.attempt = props.attempt;
    this.nextRunAt = props.nextRunAt;
    this.payload = props.payload;
    this.previousPayload = props.previousPayload;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    Object.freeze(this);
    Object.freeze(this.dependsOn);
  }

  private copy(partial: Partial<KnowledgeUpdateJobProps>, now: number): KnowledgeUpdateJob {
    return new KnowledgeUpdateJob({ ...this, ...partial, updatedAt: now });
  }

  withStatus(status: KnowledgeUpdateJobStatus, now: number): KnowledgeUpdateJob {
    return this.copy({ status }, now);
  }

  withPriority(priority: number, now: number): KnowledgeUpdateJob {
    return this.copy({ priority }, now);
  }

  withNextRunAt(nextRunAt: number | undefined, now: number): KnowledgeUpdateJob {
    return this.copy({ nextRunAt }, now);
  }

  withAttemptIncremented(now: number): KnowledgeUpdateJob {
    return this.copy({ attempt: this.attempt + 1 }, now);
  }

  withPayload(payload: Metadata, now: number): KnowledgeUpdateJob {
    return this.copy({ payload, previousPayload: this.payload }, now);
  }
}
