import { err, ok, type Result } from "@aos/common";
import { Verdict } from "@aos/meta-ads-connector";

import { DecisionError } from "../domain/errors/index.js";
import { ConfidenceScore } from "../domain/value-objects/ConfidenceScore.js";
import type { PerAdFinding } from "../types/AgentTypes.js";

export interface CampaignHealth {
  readonly healthScore: number; // 0-100
  readonly confidence: ConfidenceScore;
  readonly scaleCount: number;
  readonly keepCount: number;
  readonly reviewCount: number;
  readonly refreshCount: number;
  readonly fixCount: number;
  readonly pauseCount: number;
}

/**
 * Overall campaign-portfolio health score. `healthScore` weights SCALE/KEEP findings positively
 * against PAUSE/FIX/REFRESH findings, normalized to 0-100 — a healthier portfolio has
 * proportionally more SCALE/KEEP verdicts. `confidence` is derived from data coverage via
 * `ConfidenceScore.fromCoverage` (see that Value Object for the exact formula) — `dataCoverageFraction`
 * must be within `[0, 1]`, propagated here as a `Result` failure (`DecisionError`) rather than
 * silently clamped, per this package's zero-throw / always-Result discipline.
 */
export class CampaignHealthAnalyzer {
  static analyze(
    findings: ReadonlyArray<PerAdFinding>,
    dataCoverageFraction: number,
  ): Result<CampaignHealth, DecisionError> {
    const confidenceResult = ConfidenceScore.fromCoverage(dataCoverageFraction);
    if (!confidenceResult.ok) {
      return err(new DecisionError(confidenceResult.error.message));
    }

    const counts = {
      scaleCount: 0,
      keepCount: 0,
      reviewCount: 0,
      refreshCount: 0,
      fixCount: 0,
      pauseCount: 0,
    };
    for (const finding of findings) {
      switch (finding.verdict) {
        case Verdict.SCALE:
          counts.scaleCount += 1;
          break;
        case Verdict.KEEP:
          counts.keepCount += 1;
          break;
        case Verdict.REVIEW:
          counts.reviewCount += 1;
          break;
        case Verdict.REFRESH:
          counts.refreshCount += 1;
          break;
        case Verdict.FIX:
          counts.fixCount += 1;
          break;
        case Verdict.PAUSE:
          counts.pauseCount += 1;
          break;
        // No `default` — `Verdict` has exactly these six members, all handled above.
      }
    }

    const total = findings.length;
    const positive = counts.scaleCount + counts.keepCount;
    const healthScore = total === 0 ? 100 : Math.round((positive / total) * 100);

    return ok({ healthScore, confidence: confidenceResult.value, ...counts });
  }
}
