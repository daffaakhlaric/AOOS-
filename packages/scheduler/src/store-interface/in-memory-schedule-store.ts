import { JobState } from "../contracts/job-state.js";
import { ScheduleType } from "../contracts/schedule-type.js";
import type { JobRecord } from "../entities/job.js";
import { SchedulerException } from "../errors/scheduler-exception.js";

import type { IScheduleStore } from "./i-schedule-store.js";

/** The only `IScheduleStore` implementation in this package — in-memory, per docs/PROMPT-005.5-ENTERPRISE-SCHEDULER.md. */
export class InMemoryScheduleStore implements IScheduleStore {
  private readonly jobsById = new Map<string, JobRecord>();

  async create(job: JobRecord): Promise<JobRecord> {
    if (this.jobsById.has(job.jobId)) {
      throw new SchedulerException(`Cannot create job "${job.jobId}": already exists`);
    }
    this.jobsById.set(job.jobId, job);
    return job;
  }

  async get(jobId: string): Promise<JobRecord | undefined> {
    return this.jobsById.get(jobId);
  }

  async list(tenantId?: string): Promise<readonly JobRecord[]> {
    const all = Array.from(this.jobsById.values());
    return tenantId === undefined ? all : all.filter((job) => job.tenantId === tenantId);
  }

  async update(jobId: string, updates: Partial<JobRecord>): Promise<JobRecord> {
    const existing = this.jobsById.get(jobId);
    if (!existing) {
      throw new SchedulerException(`Cannot update job "${jobId}": not found`);
    }
    const updated: JobRecord = { ...existing, ...updates };
    this.jobsById.set(jobId, updated);
    return updated;
  }

  async delete(jobId: string): Promise<void> {
    if (!this.jobsById.delete(jobId)) {
      throw new SchedulerException(`Cannot delete job "${jobId}": not found`);
    }
  }

  async listDue(asOf: Date): Promise<readonly JobRecord[]> {
    return Array.from(this.jobsById.values()).filter(
      (job) =>
        (job.state === JobState.WAITING || job.state === JobState.RETRYING) &&
        job.nextFireAt !== undefined &&
        new Date(job.nextFireAt).getTime() <= asOf.getTime(),
    );
  }

  async listDependents(jobId: string): Promise<readonly JobRecord[]> {
    return Array.from(this.jobsById.values()).filter(
      (job) =>
        job.schedule.type === ScheduleType.DEPENDENCY &&
        job.schedule.dependsOnJobIds.includes(jobId),
    );
  }
}
