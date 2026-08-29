import type { Result } from "@aos/common";
import { ok } from "@aos/common";

import { ComparisonReportBuilder } from "../../builders/ComparisonReportBuilder.js";
import type { AiJudgeConfig } from "../../config/AiJudgeConfig.js";
import type { ComparisonReport } from "../../domain/entities/ComparisonReport.js";
import type { JudgementResult } from "../../domain/entities/JudgementResult.js";
import type { JudgeError } from "../../domain/errors/JudgeError.js";
import type { AiJudgeEvents } from "../../domain/events/AiJudgeEvents.js";

/**
 * Compares two `JudgementResult`s for the same persona — "before" and "after" a Clara refinement
 * pass (spec "Responsibilities: Compare Clara versions (before/after refinement)"; exact shape is
 * this implementation's design choice — see docs/AAOS-AI-JUDGE-REPORT.md "CompareVersions
 * design"). Purely derived from its two inputs — never re-scores, never touches `SimulationResult`.
 */
export class CompareVersions {
  constructor(
    private readonly events: AiJudgeEvents,
    private readonly config: AiJudgeConfig,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(
    before: JudgementResult,
    after: JudgementResult,
  ): Promise<Result<ComparisonReport, JudgeError>> {
    const report = ComparisonReportBuilder.build(before, after, this.clock());

    await this.events.publishVersionCompared({
      personaId: report.personaId.toString(),
      beforeJudgementId: before.id.toString(),
      afterJudgementId: after.id.toString(),
      overallScoreDelta: report.overallScoreDelta,
      verdictImproved: report.verdictImproved,
      verdictRegressed: report.verdictRegressed,
      tenantId: this.config.tenantId,
      correlationId: `compare-${after.id.toString()}`,
      occurredAt: report.comparedAt,
      version: "1.0",
    });

    return ok(report);
  }
}
