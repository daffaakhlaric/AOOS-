import { err, ok, type Result } from "@aos/common";
import { LeadTemperature } from "@aos/sales-agent";

import type { SimulatorConfig } from "../../config/SimulatorConfig.js";
import type { SimulationResult } from "../../domain/entities/SimulationResult.js";
import type { SimulatorError } from "../../domain/errors/SimulatorError.js";
import { ALL_PERSONA_IDS } from "../../domain/value-objects/PersonaId.js";
import { SessionId } from "../../domain/value-objects/SessionId.js";
import { SimulationStatus } from "../../domain/value-objects/SimulationStatus.js";
import type { PersonaRegistry } from "../../registry/PersonaRegistry.js";

import type { RunSimulation } from "./RunSimulation.js";

/**
 * Runs all 10 personas, returns all results (spec "application/use-cases/RunAllScenarios.ts").
 *
 * Batch-level error isolation: `RunSimulation` itself returns `err` when a single persona's
 * session hits a thrown/unexpected failure (design resolution #2d). `RunAllScenarios` never lets
 * one persona's failure abort the batch — an `err` from `RunSimulation` is converted here into a
 * synthesized, minimal `FAILED`-status `SimulationResult` for that persona so the returned array
 * always has exactly 10 entries and the spec's "all 10 personas run without error" business
 * correctness holds from this use case's own caller's point of view.
 */
export class RunAllScenarios {
  constructor(
    private readonly runSimulation: RunSimulation,
    private readonly personaRegistry: PersonaRegistry,
  ) {}

  async execute(
    config: SimulatorConfig,
  ): Promise<Result<ReadonlyArray<SimulationResult>, SimulatorError>> {
    const results: SimulationResult[] = [];

    for (const personaId of ALL_PERSONA_IDS) {
      const outcome = await this.runSimulation.execute(personaId, config);
      if (outcome.ok) {
        results.push(outcome.value);
        continue;
      }

      const personaResult = this.personaRegistry.get(personaId);
      if (!personaResult.ok) {
        return err(personaResult.error);
      }
      const persona = personaResult.value;

      results.push({
        sessionId: SessionId.generate(personaId, new Date()),
        personaId,
        personaDifficulty: persona.difficulty,
        status: SimulationStatus.FAILED,
        messages: [],
        totalTurns: 0,
        durationMs: 0,
        finalScore: 0,
        finalTemperature: LeadTemperature.COLD,
        handoffTriggered: false,
        handoffAtTurn: undefined,
        scoreProgression: [],
        stageTransitions: [],
        finalStage: undefined,
        expectedOutcome: persona.expectedOutcome,
        metExpectation: false,
        avgClaraResponseLength: 0,
        maxClaraResponseLength: 0,
        longestClaraMessage: "",
        claraUsedInventory: false,
        claraHandledObjection: false,
        followUpScheduled: false,
      });
    }

    return ok(results);
  }
}
