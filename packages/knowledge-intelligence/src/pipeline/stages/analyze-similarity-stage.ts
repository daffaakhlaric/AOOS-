import { SimilarityClassification } from "../../types/similarity-classification.js";
import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 4: pairwise similarity matrix + duplicate/near-duplicate classification. */
export class AnalyzeSimilarityStage implements PipelineStage {
  readonly name = "analyze-similarity";

  execute(context: PipelineContext): PipelineContext {
    const matrix = context.similarityEngine.buildMatrix(context.items);
    context.similarityMatrix = matrix;
    context.duplicates = matrix.entriesByClassification(SimilarityClassification.Duplicate);
    context.nearDuplicates = matrix.entriesByClassification(SimilarityClassification.NearDuplicate);
    return context;
  }
}
