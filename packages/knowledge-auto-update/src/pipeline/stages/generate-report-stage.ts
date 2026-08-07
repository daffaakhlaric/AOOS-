import { KnowledgeUpdateReportType } from "../../types/report-type.js";
import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 9: assembles an `UpdateSummary` report for this single job/task/result. */
export class GenerateReportStage implements PipelineStage {
  readonly name = "generate-report";

  execute(context: PipelineContext): PipelineContext {
    const now = context.clock.now();
    const report = context.reportBuilder
      .ofType(KnowledgeUpdateReportType.UpdateSummary)
      .withData({
        jobId: context.job.id,
        updateType: context.job.updateType,
        taskId: context.task?.id,
        success: context.result?.success ?? false,
        changeMagnitude: context.changeMagnitude,
        priority: context.calculatedPriority,
      })
      .build(now);
    context.report = report;
    context.registry.putReport(report);
    return context;
  }
}
