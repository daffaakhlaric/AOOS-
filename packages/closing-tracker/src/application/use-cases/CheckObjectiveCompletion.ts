import { err, ok, type Result } from "@aos/common";

import type { IReportGenerator } from "../../contracts/IReportGenerator.js";
import type { ClosingTrackerError } from "../../domain/errors/ClosingTrackerError.js";
import type { ClosingTrackerEvents } from "../../domain/events/ClosingTrackerEvents.js";
import type { ReportPeriod } from "../../domain/value-objects/ReportPeriod.js";

export interface CheckObjectiveCompletionInput {
  readonly period: ReportPeriod;
  readonly targetSpk: number;
  readonly tenantId: string;
  readonly correlationId: string;
}

export interface CheckObjectiveCompletionOutput {
  readonly targetSpk: number;
  readonly achievedSpk: number;
  readonly completed: boolean;
}

/** Did we hit the monthly SPK target? (spec: "CheckObjectiveCompletion ← did we hit monthly target?"). Emits `ObjectiveCompleted` exactly once `achievedSpk >= targetSpk` (boundary inclusive — the pinned test asserts 50/50 emits, 49/50 does not, 51/50 does). */
export class CheckObjectiveCompletion {
  constructor(
    private readonly reportGenerator: IReportGenerator,
    private readonly events: ClosingTrackerEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    input: CheckObjectiveCompletionInput,
  ): Promise<Result<CheckObjectiveCompletionOutput, ClosingTrackerError>> {
    const result = await this.reportGenerator.generate(input.period);
    if (!result.ok) {
      return err(result.error);
    }
    const achievedSpk = result.value.totalSpk;
    const completed = achievedSpk >= input.targetSpk;

    if (completed) {
      await this.events.publishObjectiveCompleted({
        targetSpk: input.targetSpk,
        achievedSpk,
        periodLabel: input.period.toLabel(),
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        occurredAt: this.now(),
        version: "1.0",
      });
    }

    return ok({ targetSpk: input.targetSpk, achievedSpk, completed });
  }
}
