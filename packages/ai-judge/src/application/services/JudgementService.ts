import type { SimulationResult } from "@aos/conversation-simulator";

import type { DimensionScores } from "../../builders/JudgementResultBuilder.js";
import { JudgementResultBuilder } from "../../builders/JudgementResultBuilder.js";
import type { AiJudgeConfig } from "../../config/AiJudgeConfig.js";
import type { IDimensionScorer } from "../../contracts/IDimensionScorer.js";
import type { JudgementResult } from "../../domain/entities/JudgementResult.js";

export interface JudgementScorers {
  readonly naturalLanguage: IDimensionScorer;
  readonly qualification: IDimensionScorer;
  readonly objectionHandling: IDimensionScorer;
  readonly closingAttempt: IDimensionScorer;
  readonly handoffQuality: IDimensionScorer;
  readonly responseLength: IDimensionScorer;
}

/**
 * Orchestrates the 6 `IDimensionScorer` strategies (spec "application/services/JudgementService.ts")
 * and hands their output to `JudgementResultBuilder`. Purely deterministic — the only "impure"
 * input is `clock`, injected so `judgedAt`/`JudgementId` stay reproducible in tests.
 */
export class JudgementService {
  constructor(
    private readonly scorers: JudgementScorers,
    private readonly config: AiJudgeConfig,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  judge(simulationResult: SimulationResult): JudgementResult {
    const dimensions: DimensionScores = {
      naturalLanguage: this.scorers.naturalLanguage.score(simulationResult, this.config),
      qualification: this.scorers.qualification.score(simulationResult, this.config),
      objectionHandling: this.scorers.objectionHandling.score(simulationResult, this.config),
      closingAttempt: this.scorers.closingAttempt.score(simulationResult, this.config),
      handoffQuality: this.scorers.handoffQuality.score(simulationResult, this.config),
      responseLength: this.scorers.responseLength.score(simulationResult, this.config),
    };

    return JudgementResultBuilder.build({
      sessionId: simulationResult.sessionId,
      personaId: simulationResult.personaId,
      personaDifficulty: simulationResult.personaDifficulty,
      dimensions,
      config: this.config,
      now: this.clock(),
    });
  }
}
