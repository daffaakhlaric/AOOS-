import { KnowledgeAutoUpdateEventType } from "../../events/knowledge-auto-update-event-type.js";
import { KnowledgeUpdateType } from "../../types/update-type.js";
import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 10: publishes `ReportGenerated`, plus `KnowledgeRefreshed` for successful refresh jobs. */
export class PublishEventsStage implements PipelineStage {
  readonly name = "publish-events";

  execute(context: PipelineContext): PipelineContext {
    if (context.report) {
      context.eventPublisher.publish(KnowledgeAutoUpdateEventType.ReportGenerated, {
        reportId: context.report.id,
        reportType: context.report.type,
        runId: context.runId,
      });
    }
    if (context.job.updateType === KnowledgeUpdateType.Refresh && context.result?.success) {
      context.eventPublisher.publish(KnowledgeAutoUpdateEventType.KnowledgeRefreshed, {
        jobId: context.job.id,
        targetId: context.job.targetId,
        runId: context.runId,
      });
      context.statistics.recordRefresh(context.result.durationMs);
    }
    return context;
  }
}
