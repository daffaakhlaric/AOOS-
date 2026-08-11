import type { Result } from "@aos/common";

import type { SimulationResult } from "../../domain/entities/SimulationResult.js";
import type { SimulatorError } from "../../domain/errors/SimulatorError.js";
import type { SimulationRunnerService } from "../services/SimulationRunnerService.js";

/** Looks up a previously completed `SimulationResult` by session id (spec "application/use-cases/GetSimulationResult.ts"). In-memory only — this package never persists to Supabase. */
export class GetSimulationResult {
  constructor(private readonly runner: SimulationRunnerService) {}

  execute(sessionId: string): Result<SimulationResult, SimulatorError> {
    return this.runner.getResult(sessionId);
  }
}
