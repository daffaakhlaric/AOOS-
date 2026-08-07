import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 2: structural analysis, producing `KnowledgeFinding`s per item. */
export class AnalyzeStructureStage implements PipelineStage {
  readonly name = "analyze-structure";

  execute(context: PipelineContext): PipelineContext {
    context.findings = context.analysisEngine.analyzeCorpusStructure(context.items);
    return context;
  }
}
