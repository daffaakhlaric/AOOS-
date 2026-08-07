import { KnowledgeUpdateReportBuilder } from "../../src/builders/knowledge-update-report-builder.js";
import type { KnowledgeUpdateJob } from "../../src/entities/knowledge-update-job.js";
import { KnowledgeUpdateTask } from "../../src/entities/knowledge-update-task.js";
import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeUpdateJobFactory } from "../../src/factories/knowledge-update-job-factory.js";
import { KnowledgeUpdatePolicyFactory } from "../../src/factories/knowledge-update-policy-factory.js";
import { KnowledgeUpdateResultFactory } from "../../src/factories/knowledge-update-result-factory.js";
import { KnowledgeUpdateTaskFactory } from "../../src/factories/knowledge-update-task-factory.js";
import type { PipelineContext, PipelineServices } from "../../src/pipeline/pipeline-stage.js";
import { KnowledgeUpdateRegistry } from "../../src/registry/knowledge-update-registry.js";
import { KnowledgeChangeAnalyzer } from "../../src/services/knowledge-change-analyzer.js";
import { KnowledgeConflictResolver } from "../../src/services/knowledge-conflict-resolver.js";
import { KnowledgeDependencyAnalyzer } from "../../src/services/knowledge-dependency-analyzer.js";
import { KnowledgePriorityCalculator } from "../../src/services/knowledge-priority-calculator.js";
import { KnowledgeStalenessAnalyzer } from "../../src/services/knowledge-staleness-analyzer.js";
import { KnowledgeUpdateDetector } from "../../src/services/knowledge-update-detector.js";
import { KnowledgeUpdateStatistics } from "../../src/services/knowledge-update-statistics.js";
import { KnowledgeUpdateValidator } from "../../src/services/knowledge-update-validator.js";
import { KnowledgeUpdateStrategyRegistry } from "../../src/strategies/knowledge-update-strategy-registry.js";
import type { Metadata } from "../../src/types/common.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { ManualClock } from "../../src/utils/clock.js";
import type { KnowledgeUpdatePolicy } from "../../src/value-objects/knowledge-update-policy.js";

let taskCounter = 0;

export function makeTask(
  overrides: Partial<{ payload: Metadata; previousPayload: Metadata; attempt: number }> = {},
): KnowledgeUpdateTask {
  taskCounter += 1;
  return new KnowledgeUpdateTask({
    id: `fixture-task-${taskCounter}`,
    jobId: "job-1",
    sessionId: "session-1",
    updateType: KnowledgeUpdateType.Manual,
    targetId: "target-1",
    payload: overrides.payload ?? {},
    previousPayload: overrides.previousPayload,
    attempt: overrides.attempt ?? 0,
    createdAt: 0,
  });
}

export function makePipelineServices(
  clock: ManualClock = new ManualClock(0),
  eventPublisher: InMemoryEventPublisher = new InMemoryEventPublisher(clock),
): PipelineServices {
  return {
    clock,
    registry: new KnowledgeUpdateRegistry(),
    detector: new KnowledgeUpdateDetector(),
    changeAnalyzer: new KnowledgeChangeAnalyzer(),
    validator: new KnowledgeUpdateValidator(),
    dependencyAnalyzer: new KnowledgeDependencyAnalyzer(),
    conflictResolver: new KnowledgeConflictResolver(),
    stalenessAnalyzer: new KnowledgeStalenessAnalyzer(),
    priorityCalculator: new KnowledgePriorityCalculator(),
    strategyRegistry: new KnowledgeUpdateStrategyRegistry(),
    taskFactory: new KnowledgeUpdateTaskFactory(),
    resultFactory: new KnowledgeUpdateResultFactory(),
    reportBuilder: new KnowledgeUpdateReportBuilder(),
    statistics: new KnowledgeUpdateStatistics(),
    eventPublisher,
  };
}

let contextRunCounter = 0;

export interface MakeContextOptions {
  readonly job?: KnowledgeUpdateJob;
  readonly policy?: KnowledgeUpdatePolicy;
  readonly services?: PipelineServices;
  readonly dependentCount?: number;
  readonly sessionId?: string;
  readonly conflictCandidates?: PipelineContext["conflictCandidates"];
}

/** Builds a full, runnable `PipelineContext` with sensible defaults for single-stage tests. */
export function makeContext(options: MakeContextOptions = {}): PipelineContext {
  contextRunCounter += 1;
  const services = options.services ?? makePipelineServices();
  const job =
    options.job ??
    new KnowledgeUpdateJobFactory().create({ targetId: "target-1", policyId: "policy-1" }, 0);
  const policy =
    options.policy ?? new KnowledgeUpdatePolicyFactory().create({ name: "ctx-policy" });
  services.registry.putPolicy(policy);
  services.registry.putJob(job);
  return {
    ...services,
    job,
    policy,
    sessionId: options.sessionId ?? "session-1",
    dependentCount: options.dependentCount ?? 0,
    conflictCandidates: options.conflictCandidates,
    runId: `run-${contextRunCounter}`,
  };
}
