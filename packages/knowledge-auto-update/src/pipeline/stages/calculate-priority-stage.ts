import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 6: computes the job's numeric priority from base priority, staleness, and dependents. */
export class CalculatePriorityStage implements PipelineStage {
  readonly name = "calculate-priority";

  execute(context: PipelineContext): PipelineContext {
    const lastUpdatedAt =
      typeof context.job.previousPayload?.lastModifiedAt === "number"
        ? context.job.previousPayload.lastModifiedAt
        : context.job.createdAt;
    const staleness = context.stalenessAnalyzer.analyze(
      lastUpdatedAt,
      context.clock.now(),
      context.policy.freshness,
    );
    const stalenessRatio = staleness.maxAgeMs === 0 ? 0 : staleness.ageMs / staleness.maxAgeMs;

    context.calculatedPriority = context.priorityCalculator.calculate(
      {
        basePriority: context.job.priority,
        stalenessRatio,
        dependentCount: context.dependentCount,
      },
      context.policy.priority,
    );
    return context;
  }
}
