import { PipelineStageFailureException } from "../errors/pipeline-stage-failure-exception.js";
import { generateId } from "../utils/id-generator.js";

import type {
  PipelineContext,
  PipelineRunInput,
  PipelineServices,
  PipelineStage,
} from "./pipeline-stage.js";
import { AnalyzeChangesStage } from "./stages/analyze-changes-stage.js";
import { CalculatePriorityStage } from "./stages/calculate-priority-stage.js";
import { DetectChangesStage } from "./stages/detect-changes-stage.js";
import { ExecuteUpdateStage } from "./stages/execute-update-stage.js";
import { GenerateReportStage } from "./stages/generate-report-stage.js";
import { PublishEventsStage } from "./stages/publish-events-stage.js";
import { ResolveConflictsStage } from "./stages/resolve-conflicts-stage.js";
import { ResolveDependenciesStage } from "./stages/resolve-dependencies-stage.js";
import { ValidateResultStage } from "./stages/validate-result-stage.js";
import { ValidateUpdateStage } from "./stages/validate-update-stage.js";

/**
 * Real sequential 10-stage update flow: Detect Changes -> Analyze Changes -> Validate Update ->
 * Resolve Dependencies -> Resolve Conflicts -> Calculate Priority -> Execute Update -> Validate
 * Result -> Generate Report -> Publish Events. Runs once per due job (see
 * `KnowledgeUpdateCoordinator`, which loops the pipeline across a scheduler tick's due jobs in
 * dependency+priority order).
 */
export class KnowledgeUpdatePipeline {
  private readonly stages: readonly PipelineStage[];

  constructor(stages?: readonly PipelineStage[]) {
    this.stages = stages ?? [
      new DetectChangesStage(),
      new AnalyzeChangesStage(),
      new ValidateUpdateStage(),
      new ResolveDependenciesStage(),
      new ResolveConflictsStage(),
      new CalculatePriorityStage(),
      new ExecuteUpdateStage(),
      new ValidateResultStage(),
      new GenerateReportStage(),
      new PublishEventsStage(),
    ];
  }

  run(input: PipelineRunInput, services: PipelineServices): PipelineContext {
    const runId = generateId("run");
    let context: PipelineContext = { ...input, ...services, runId };

    let currentStageName = "unknown";
    for (const stage of this.stages) {
      currentStageName = stage.name;
      try {
        context = stage.execute(context);
      } catch (error) {
        throw new PipelineStageFailureException(currentStageName, error);
      }
    }

    return context;
  }
}
