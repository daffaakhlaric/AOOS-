import type { KnowledgeUpdateResult } from "../entities/knowledge-update-result.js";
import type { KnowledgeUpdateTask } from "../entities/knowledge-update-task.js";
import { KnowledgeUpdateResultFactory } from "../factories/knowledge-update-result-factory.js";
import type { Metadata } from "../types/common.js";
import type { KnowledgeUpdateType } from "../types/update-type.js";

import type {
  IKnowledgeUpdateStrategy,
  StrategyExecutionContext,
} from "./i-knowledge-update-strategy.js";

/**
 * Template-method base for every concrete update strategy: subclasses implement only
 * `computeAppliedPayload`, which may throw to signal a failed update (translated into a failure
 * `KnowledgeUpdateResult` rather than propagating). `durationMs` is always 0 — every strategy is a
 * synchronous, pure transformation of caller-supplied payloads (this package never touches real
 * content or real I/O), so no wall-clock time genuinely elapses during execution.
 */
export abstract class BaseKnowledgeUpdateStrategy implements IKnowledgeUpdateStrategy {
  abstract readonly updateType: KnowledgeUpdateType;
  private readonly resultFactory: KnowledgeUpdateResultFactory;

  constructor(resultFactory: KnowledgeUpdateResultFactory = new KnowledgeUpdateResultFactory()) {
    this.resultFactory = resultFactory;
  }

  execute(context: StrategyExecutionContext): KnowledgeUpdateResult {
    try {
      const applied = this.computeAppliedPayload(context.task, context.now);
      return this.resultFactory.createSuccess(
        context.task.id,
        context.task.jobId,
        applied,
        0,
        context.now,
      );
    } catch (error) {
      return this.resultFactory.createFailure(
        context.task.id,
        context.task.jobId,
        error instanceof Error ? error.message : String(error),
        0,
        context.now,
      );
    }
  }

  protected abstract computeAppliedPayload(task: KnowledgeUpdateTask, now: number): Metadata;
}
