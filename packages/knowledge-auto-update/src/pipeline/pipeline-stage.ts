import type { KnowledgeUpdateReportBuilder } from "../builders/knowledge-update-report-builder.js";
import type { IClock } from "../contracts/i-clock.js";
import type { IKnowledgeAutoUpdateEventPublisher } from "../contracts/i-knowledge-auto-update-event-publisher.js";
import type { KnowledgeUpdateJob } from "../entities/knowledge-update-job.js";
import type { KnowledgeUpdateReport } from "../entities/knowledge-update-report.js";
import type { KnowledgeUpdateResult } from "../entities/knowledge-update-result.js";
import type { KnowledgeUpdateTask } from "../entities/knowledge-update-task.js";
import type { KnowledgeUpdateResultFactory } from "../factories/knowledge-update-result-factory.js";
import type { KnowledgeUpdateTaskFactory } from "../factories/knowledge-update-task-factory.js";
import type { KnowledgeUpdateRegistry } from "../registry/knowledge-update-registry.js";
import type { KnowledgeChangeAnalyzer } from "../services/knowledge-change-analyzer.js";
import type {
  ConflictCandidate,
  ConflictResolution,
  KnowledgeConflictResolver,
} from "../services/knowledge-conflict-resolver.js";
import type { KnowledgeDependencyAnalyzer } from "../services/knowledge-dependency-analyzer.js";
import type { KnowledgePriorityCalculator } from "../services/knowledge-priority-calculator.js";
import type { KnowledgeStalenessAnalyzer } from "../services/knowledge-staleness-analyzer.js";
import type {
  ChangeDetectionResult,
  KnowledgeUpdateDetector,
} from "../services/knowledge-update-detector.js";
import type { KnowledgeUpdateStatistics } from "../services/knowledge-update-statistics.js";
import type { KnowledgeUpdateValidator } from "../services/knowledge-update-validator.js";
import type { KnowledgeUpdateStrategyRegistry } from "../strategies/knowledge-update-strategy-registry.js";
import type { ChangeMagnitude } from "../types/change-magnitude.js";
import type { KnowledgeUpdatePolicy } from "../value-objects/knowledge-update-policy.js";

/** Services shared by every pipeline stage, injected once at pipeline construction. */
export interface PipelineServices {
  readonly clock: IClock;
  readonly registry: KnowledgeUpdateRegistry;
  readonly detector: KnowledgeUpdateDetector;
  readonly changeAnalyzer: KnowledgeChangeAnalyzer;
  readonly validator: KnowledgeUpdateValidator;
  readonly dependencyAnalyzer: KnowledgeDependencyAnalyzer;
  readonly conflictResolver: KnowledgeConflictResolver;
  readonly stalenessAnalyzer: KnowledgeStalenessAnalyzer;
  readonly priorityCalculator: KnowledgePriorityCalculator;
  readonly strategyRegistry: KnowledgeUpdateStrategyRegistry;
  readonly taskFactory: KnowledgeUpdateTaskFactory;
  readonly resultFactory: KnowledgeUpdateResultFactory;
  readonly reportBuilder: KnowledgeUpdateReportBuilder;
  readonly statistics: KnowledgeUpdateStatistics;
  readonly eventPublisher: IKnowledgeAutoUpdateEventPublisher;
}

/** Everything one `KnowledgeUpdatePipeline.run()` call needs for a single job. */
export interface PipelineRunInput {
  readonly job: KnowledgeUpdateJob;
  readonly policy: KnowledgeUpdatePolicy;
  readonly sessionId: string;
  readonly dependentCount: number;
  readonly conflictCandidates?: readonly ConflictCandidate[];
}

/** The mutable working state threaded through the 10 pipeline stages. */
export interface PipelineContext extends PipelineRunInput, PipelineServices {
  readonly runId: string;
  detection?: ChangeDetectionResult;
  changeMagnitude?: ChangeMagnitude;
  conflictResolution?: ConflictResolution;
  calculatedPriority?: number;
  task?: KnowledgeUpdateTask;
  result?: KnowledgeUpdateResult;
  report?: KnowledgeUpdateReport;
}

/** One stage of the `KnowledgeUpdatePipeline`. Mutates `context` in place and returns it. */
export interface PipelineStage {
  readonly name: string;
  execute(context: PipelineContext): PipelineContext;
}
