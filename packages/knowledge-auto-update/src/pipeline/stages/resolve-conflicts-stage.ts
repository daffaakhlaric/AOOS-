import { KnowledgeAutoUpdateEventType } from "../../events/knowledge-auto-update-event-type.js";
import type { ConflictCandidate } from "../../services/knowledge-conflict-resolver.js";
import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/**
 * Stage 5: resolves competing candidates for the same target (if the caller supplied more than
 * one via `conflictCandidates`); a single implicit candidate (the job's own payload) never
 * triggers `ConflictDetected`/`ConflictResolved`.
 */
export class ResolveConflictsStage implements PipelineStage {
  readonly name = "resolve-conflicts";

  execute(context: PipelineContext): PipelineContext {
    const candidates: ConflictCandidate[] =
      context.conflictCandidates && context.conflictCandidates.length > 0
        ? [...context.conflictCandidates]
        : [
            {
              source: context.job.id,
              payload: context.job.payload,
              updatedAt: context.clock.now(),
            },
          ];

    if (candidates.length > 1) {
      context.eventPublisher.publish(KnowledgeAutoUpdateEventType.ConflictDetected, {
        jobId: context.job.id,
        runId: context.runId,
        candidateCount: candidates.length,
      });
      context.statistics.recordConflict();
    }

    const resolution = context.conflictResolver.resolve(
      context.job.id,
      candidates,
      context.policy.conflictResolution.strategy,
    );
    context.conflictResolution = resolution;

    if (candidates.length > 1) {
      context.eventPublisher.publish(KnowledgeAutoUpdateEventType.ConflictResolved, {
        jobId: context.job.id,
        runId: context.runId,
        strategy: resolution.strategy,
        winner: resolution.winner.source,
      });
    }

    return context;
  }
}
