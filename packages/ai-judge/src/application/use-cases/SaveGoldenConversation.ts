import type { Result } from "@aos/common";
import type { SimulationResult } from "@aos/conversation-simulator";

import type { AiJudgeConfig } from "../../config/AiJudgeConfig.js";
import type { GoldenConversation } from "../../domain/entities/GoldenConversation.js";
import type { JudgementResult } from "../../domain/entities/JudgementResult.js";
import type { JudgeError } from "../../domain/errors/JudgeError.js";
import type { AiJudgeEvents } from "../../domain/events/AiJudgeEvents.js";
import type { GoldenDatasetService } from "../services/GoldenDatasetService.js";

/** Saves a high-scoring conversation into the golden dataset (spec "application/use-cases/SaveGoldenConversation.ts"). */
export class SaveGoldenConversation {
  constructor(
    private readonly goldenDatasetService: GoldenDatasetService,
    private readonly events: AiJudgeEvents,
    private readonly config: AiJudgeConfig,
  ) {}

  async execute(
    simulationResult: SimulationResult,
    judgementResult: JudgementResult,
    tags: ReadonlyArray<string> = [],
  ): Promise<Result<GoldenConversation, JudgeError>> {
    const saved = this.goldenDatasetService.save(simulationResult, judgementResult, tags);
    if (!saved.ok) {
      return saved;
    }

    await this.events.publishGoldenConversationSaved({
      goldenConversationId: saved.value.id,
      sessionId: simulationResult.sessionId.toString(),
      personaId: simulationResult.personaId.toString(),
      overallScore: judgementResult.overallScore.value,
      tags: saved.value.tags,
      tenantId: this.config.tenantId,
      correlationId: `golden-${simulationResult.sessionId.toString()}`,
      occurredAt: saved.value.savedAt,
      version: "1.0",
    });

    return saved;
  }
}
