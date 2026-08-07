import { PipelineStageFailureException } from "../errors/pipeline-stage-failure-exception.js";
import { generateId } from "../utils/id-generator.js";

import type {
  PipelineContext,
  PipelineRunInput,
  PipelineServices,
  PipelineStage,
} from "./pipeline-stage.js";
import { AnalyzeCoverageStage } from "./stages/analyze-coverage-stage.js";
import { AnalyzeFreshnessStage } from "./stages/analyze-freshness-stage.js";
import { AnalyzeQualityStage } from "./stages/analyze-quality-stage.js";
import { AnalyzeRelationshipsStage } from "./stages/analyze-relationships-stage.js";
import { AnalyzeRisksStage } from "./stages/analyze-risks-stage.js";
import { AnalyzeSimilarityStage } from "./stages/analyze-similarity-stage.js";
import { AnalyzeStructureStage } from "./stages/analyze-structure-stage.js";
import { CollectKnowledgeStage } from "./stages/collect-knowledge-stage.js";
import { GenerateIntelligenceReportStage } from "./stages/generate-intelligence-report-stage.js";
import { GenerateRecommendationsStage } from "./stages/generate-recommendations-stage.js";
import { PublishEventsStage } from "./stages/publish-events-stage.js";

/**
 * Real sequential 11-stage analysis flow (spec "Analysis Pipeline"): Collect Knowledge -> Analyze
 * Structure -> Analyze Relationships -> Analyze Similarity -> Analyze Coverage -> Analyze Quality
 * -> Analyze Freshness -> Analyze Risks -> Generate Recommendations -> Generate Intelligence
 * Report -> Publish Events. Each stage delegates to the injected domain services — no stubs.
 */
export class KnowledgeIntelligencePipeline {
  private readonly stages: readonly PipelineStage[];

  constructor(stages?: readonly PipelineStage[]) {
    this.stages = stages ?? [
      new CollectKnowledgeStage(),
      new AnalyzeStructureStage(),
      new AnalyzeRelationshipsStage(),
      new AnalyzeSimilarityStage(),
      new AnalyzeCoverageStage(),
      new AnalyzeQualityStage(),
      new AnalyzeFreshnessStage(),
      new AnalyzeRisksStage(),
      new GenerateRecommendationsStage(),
      new GenerateIntelligenceReportStage(),
      new PublishEventsStage(),
    ];
  }

  run(input: PipelineRunInput, services: PipelineServices): PipelineContext {
    const runId = generateId("run");
    let context: PipelineContext = { ...input, ...services, runId };

    let currentStageName = "unknown";
    try {
      for (const stage of this.stages) {
        currentStageName = stage.name;
        context = stage.execute(context);
      }
    } catch (error) {
      if (error instanceof PipelineStageFailureException) throw error;
      throw new PipelineStageFailureException(currentStageName, error);
    }

    return context;
  }
}
