import { err, ok, type Result } from "@aos/common";
import type { SimulationResult } from "@aos/conversation-simulator";

import type { AiJudgeConfig } from "../../config/AiJudgeConfig.js";
import type { JudgementResult } from "../../domain/entities/JudgementResult.js";
import { InvalidSimulationError } from "../../domain/errors/InvalidSimulationError.js";
import type { JudgeError } from "../../domain/errors/JudgeError.js";
import type { AiJudgeEvents } from "../../domain/events/AiJudgeEvents.js";
import type { JudgementService } from "../services/JudgementService.js";

/** Main entry point (spec "application/use-cases/JudgeConversation.ts"): `SimulationResult` -> `JudgementResult`. */
export class JudgeConversation {
  constructor(
    private readonly judgementService: JudgementService,
    private readonly events: AiJudgeEvents,
    private readonly config: AiJudgeConfig,
  ) {}

  async execute(simulationResult: SimulationResult): Promise<Result<JudgementResult, JudgeError>> {
    if (simulationResult.messages.length === 0) {
      return err(new InvalidSimulationError("simulation has no messages to score"));
    }

    const result = this.judgementService.judge(simulationResult);

    await this.events.publishJudgementCompleted({
      judgementId: result.id.toString(),
      sessionId: result.simulationSessionId.toString(),
      personaId: result.personaId.toString(),
      overallScore: result.overallScore.value,
      grade: result.grade,
      verdict: result.verdict,
      isGoldenCandidate: result.isGoldenCandidate,
      tenantId: this.config.tenantId,
      correlationId: `judge-${result.simulationSessionId.toString()}`,
      occurredAt: result.judgedAt,
      version: "1.0",
    });

    return ok(result);
  }
}
