import { err, ErrorCode, ok, type Result } from "@aos/common";
import type { SimulationResult } from "@aos/conversation-simulator";
import { LeadTemperature } from "@aos/sales-agent";

import type { GoldenConversation } from "../../domain/entities/GoldenConversation.js";
import type { JudgementResult } from "../../domain/entities/JudgementResult.js";
import { JudgeError } from "../../domain/errors/JudgeError.js";
import type { GoldenDatasetRegistry } from "../../registry/GoldenDatasetRegistry.js";

let sequence = 0;

/** Resets the module-local sequence counter — test-only, so generated golden ids stay deterministic across specs. */
export function resetGoldenConversationIdSequence(): void {
  sequence = 0;
}

/**
 * Decides whether a `JudgementResult` qualifies for the golden dataset and, if so, saves it with
 * derived tags (spec "Golden Dataset"). One instance per `AiJudgeFactory.create()` call.
 */
export class GoldenDatasetService {
  constructor(
    private readonly registry: GoldenDatasetRegistry,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  save(
    simulationResult: SimulationResult,
    judgementResult: JudgementResult,
    extraTags: ReadonlyArray<string> = [],
  ): Result<GoldenConversation, JudgeError> {
    if (!judgementResult.isGoldenCandidate) {
      return err(
        new JudgeError(
          ErrorCode.VALIDATION_ERROR,
          `Cannot save as golden: overallScore ${judgementResult.overallScore.value} is below the golden threshold`,
        ),
      );
    }

    const now = this.clock();
    sequence += 1;
    const golden: GoldenConversation = {
      id: `golden-${simulationResult.sessionId.toString()}-${now.getTime()}-${sequence}`,
      personaId: simulationResult.personaId,
      simulationResult,
      judgementResult,
      savedAt: now,
      tags: this.deriveTags(simulationResult, judgementResult, extraTags),
    };
    this.registry.add(golden);
    return ok(golden);
  }

  getAll(): ReadonlyArray<GoldenConversation> {
    return this.registry.getAll();
  }

  private deriveTags(
    simulationResult: SimulationResult,
    judgementResult: JudgementResult,
    extraTags: ReadonlyArray<string>,
  ): ReadonlyArray<string> {
    const tags = new Set<string>(extraTags);
    tags.add(simulationResult.personaId.toString());
    if (simulationResult.finalTemperature === LeadTemperature.HOT) {
      tags.add("hot-lead");
    }
    if (simulationResult.handoffTriggered) {
      tags.add("handoff");
    }
    const objectionWasHandled = judgementResult.objectionHandling.appliedRules.some(
      (rule) => rule.rule === "ENTERED_OBJECTION_STAGE",
    );
    if (objectionWasHandled) {
      tags.add("objection-handled");
    }
    return Array.from(tags);
  }
}
