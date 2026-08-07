import { KnowledgeUpdateTask } from "../../entities/knowledge-update-task.js";
import { KnowledgeAutoUpdateEventType } from "../../events/knowledge-auto-update-event-type.js";
import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 7: dispatches to the resolved `IKnowledgeUpdateStrategy` for this job's update type. */
export class ExecuteUpdateStage implements PipelineStage {
  readonly name = "execute-update";

  execute(context: PipelineContext): PipelineContext {
    const now = context.clock.now();
    const baseTask = context.taskFactory.create(context.job, context.sessionId, now);
    const task =
      context.conflictResolution &&
      context.conflictResolution.winner.payload !== context.job.payload
        ? new KnowledgeUpdateTask({
            ...baseTask,
            payload: context.conflictResolution.winner.payload,
          })
        : baseTask;
    context.task = task;
    context.registry.putTask(task);

    context.statistics.recordUpdateStarted();
    context.eventPublisher.publish(KnowledgeAutoUpdateEventType.UpdateStarted, {
      jobId: context.job.id,
      taskId: task.id,
      runId: context.runId,
    });

    const strategy = context.strategyRegistry.resolve(context.job.updateType);
    const result = strategy.execute({ task, now: context.clock.now() });
    context.result = result;
    context.registry.putResult(result);

    if (result.success) {
      context.statistics.recordUpdateSucceeded(result.durationMs);
      context.eventPublisher.publish(KnowledgeAutoUpdateEventType.UpdateCompleted, {
        jobId: context.job.id,
        taskId: task.id,
        runId: context.runId,
      });
    } else {
      context.statistics.recordUpdateFailed();
      context.eventPublisher.publish(KnowledgeAutoUpdateEventType.UpdateFailed, {
        jobId: context.job.id,
        taskId: task.id,
        runId: context.runId,
        reason: result.errorMessage,
      });
    }

    return context;
  }
}
