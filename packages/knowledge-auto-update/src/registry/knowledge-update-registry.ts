import type { KnowledgeUpdateHistory } from "../entities/knowledge-update-history.js";
import type { KnowledgeUpdateJob } from "../entities/knowledge-update-job.js";
import type { KnowledgeUpdateReport } from "../entities/knowledge-update-report.js";
import type { KnowledgeUpdateResult } from "../entities/knowledge-update-result.js";
import type { KnowledgeUpdateSession } from "../entities/knowledge-update-session.js";
import type { KnowledgeUpdateTask } from "../entities/knowledge-update-task.js";
import { JobNotFoundException } from "../errors/job-not-found-exception.js";
import { PolicyNotFoundException } from "../errors/policy-not-found-exception.js";
import { ReportNotFoundException } from "../errors/report-not-found-exception.js";
import { SessionNotFoundException } from "../errors/session-not-found-exception.js";
import { TaskNotFoundException } from "../errors/task-not-found-exception.js";
import type { KnowledgeUpdatePolicy } from "../value-objects/knowledge-update-policy.js";

/**
 * Id-keyed, in-memory buckets for every entity this package tracks. All lookups are `Map.get` by
 * id — never a linear scan. Buckets: jobs, tasks, results, sessions, reports, policies, history
 * (one `KnowledgeUpdateHistory` per job id).
 */
export class KnowledgeUpdateRegistry {
  private readonly jobs = new Map<string, KnowledgeUpdateJob>();
  private readonly tasks = new Map<string, KnowledgeUpdateTask>();
  private readonly results = new Map<string, KnowledgeUpdateResult>();
  private readonly sessions = new Map<string, KnowledgeUpdateSession>();
  private readonly reports = new Map<string, KnowledgeUpdateReport>();
  private readonly policies = new Map<string, KnowledgeUpdatePolicy>();
  private readonly history = new Map<string, KnowledgeUpdateHistory>();

  // Jobs
  putJob(job: KnowledgeUpdateJob): void {
    this.jobs.set(job.id, job);
  }
  getJob(id: string): KnowledgeUpdateJob {
    const job = this.jobs.get(id);
    if (!job) throw new JobNotFoundException(id);
    return job;
  }
  findJob(id: string): KnowledgeUpdateJob | undefined {
    return this.jobs.get(id);
  }
  hasJob(id: string): boolean {
    return this.jobs.has(id);
  }
  removeJob(id: string): void {
    this.jobs.delete(id);
  }
  listJobs(): readonly KnowledgeUpdateJob[] {
    return [...this.jobs.values()];
  }

  // Tasks
  putTask(task: KnowledgeUpdateTask): void {
    this.tasks.set(task.id, task);
  }
  getTask(id: string): KnowledgeUpdateTask {
    const task = this.tasks.get(id);
    if (!task) throw new TaskNotFoundException(id);
    return task;
  }
  listTasks(): readonly KnowledgeUpdateTask[] {
    return [...this.tasks.values()];
  }

  // Results
  putResult(result: KnowledgeUpdateResult): void {
    this.results.set(result.id, result);
  }
  getResult(id: string): KnowledgeUpdateResult | undefined {
    return this.results.get(id);
  }
  listResults(): readonly KnowledgeUpdateResult[] {
    return [...this.results.values()];
  }

  // Sessions
  putSession(session: KnowledgeUpdateSession): void {
    this.sessions.set(session.id, session);
  }
  getSession(id: string): KnowledgeUpdateSession {
    const session = this.sessions.get(id);
    if (!session) throw new SessionNotFoundException(id);
    return session;
  }
  listSessions(): readonly KnowledgeUpdateSession[] {
    return [...this.sessions.values()];
  }

  // Reports
  putReport(report: KnowledgeUpdateReport): void {
    this.reports.set(report.id, report);
  }
  getReport(id: string): KnowledgeUpdateReport {
    const report = this.reports.get(id);
    if (!report) throw new ReportNotFoundException(id);
    return report;
  }
  listReports(): readonly KnowledgeUpdateReport[] {
    return [...this.reports.values()];
  }

  // Policies
  putPolicy(policy: KnowledgeUpdatePolicy): void {
    this.policies.set(policy.id, policy);
  }
  getPolicy(id: string): KnowledgeUpdatePolicy {
    const policy = this.policies.get(id);
    if (!policy) throw new PolicyNotFoundException(id);
    return policy;
  }
  listPolicies(): readonly KnowledgeUpdatePolicy[] {
    return [...this.policies.values()];
  }

  // History
  putHistory(history: KnowledgeUpdateHistory): void {
    this.history.set(history.jobId, history);
  }
  getHistory(jobId: string): KnowledgeUpdateHistory | undefined {
    return this.history.get(jobId);
  }
}
