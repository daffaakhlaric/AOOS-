import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 2: classifies the magnitude/nature of the detected change. */
export class AnalyzeChangesStage implements PipelineStage {
  readonly name = "analyze-changes";

  execute(context: PipelineContext): PipelineContext {
    context.changeMagnitude = context.changeAnalyzer.classify(
      context.detection ?? { changed: true, reasons: [] },
    );
    return context;
  }
}
