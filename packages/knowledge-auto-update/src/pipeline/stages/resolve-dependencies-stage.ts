import { DependencyNotSatisfiedException } from "../../errors/dependency-not-satisfied-exception.js";
import { KnowledgeUpdateJobStatus } from "../../types/job-status.js";
import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/**
 * Stage 4: every job this job `dependsOn` must exist and be `Completed` (or `Cancelled`, which is
 * treated as "no longer blocking"). Throws `DependencyNotSatisfiedException` otherwise, which the
 * coordinator treats as "not yet runnable" rather than a hard failure.
 */
export class ResolveDependenciesStage implements PipelineStage {
  readonly name = "resolve-dependencies";

  execute(context: PipelineContext): PipelineContext {
    const blockedOn: string[] = [];
    for (const depId of context.job.dependsOn) {
      const dep = context.registry.getJob(depId);
      if (
        dep.status !== KnowledgeUpdateJobStatus.Completed &&
        dep.status !== KnowledgeUpdateJobStatus.Cancelled
      ) {
        blockedOn.push(depId);
      }
    }
    if (blockedOn.length > 0) {
      throw new DependencyNotSatisfiedException(context.job.id, blockedOn);
    }
    return context;
  }
}
