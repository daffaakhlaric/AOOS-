/**
 * Real, LOCAL "anomaly signal" detector — the honestly-scoped-down replacement for the fictional
 * `ads_insights_anomaly_signal` Meta MCP tool (see `docs/PROMPT-AAOS-META-MCP-BONUS-TOOLS.md`'s
 * COORDINATOR NOTE section 4). No such Meta tool/endpoint exists; this class computes ONE real
 * anomaly type from data this app already pulls, with zero new persistence required.
 *
 * **Why only `FREQUENCY_HIGH`**: every other anomaly type in the spec's original enum
 * (`SPEND_DROP`/`SPEND_SPIKE`/`CPL_INCREASE`/`CTR_DROP`) requires a "current vs. historical/
 * expected" comparison — this app has NO time-series/historical metrics storage anywhere
 * (`PullCampaignData` pulls current-state `AdMetrics` fresh on every call; nothing persists
 * yesterday's numbers). Faking an "expected value" baseline would be exactly the kind of
 * fabrication this whole effort has consistently avoided. `DELIVERY_ISSUE`/`LOW_QUALITY_SCORE`
 * are Meta-internal signals with no real local proxy at all. All five are DEFERRED, not built —
 * they need real historical persistence (or, for the latter two, a real Meta API this session has
 * not found) as a separate, later piece of work.
 *
 * **Why `FREQUENCY_HIGH` IS honestly computable today**: `AdMetrics.frequency`
 * (`impressions / reach`, already computed by `@aos/meta-ads-connector` on every real pull) is a
 * direct, already-available creative-fatigue signal — no history needed, just the current pull.
 *
 * **Threshold — real, cited, not invented**: this class reuses this SAME codebase's own
 * pre-existing `FATIGUE_FREQUENCY_THRESHOLD = 3.5` constant
 * (`application/services/HistoricalLearningService.ts`'s fatigue-pattern scoring, and
 * `builders/CreativeBriefBuilder.ts`'s `urgencyFor` — `>3` MEDIUM / `>4.5` HIGH creative-refresh
 * urgency tiers) rather than inventing a second, conflicting number for the same real-world
 * phenomenon. That number is independently corroborated by real, current (2026) industry research
 * on Meta Ads frequency/fatigue:
 * - AdAmigo.ai, "Meta Ads Frequency Benchmarks (When Ads Start Fatiguing)" —
 *   https://www.adamigo.ai/blog/meta-ads-frequency-benchmarks-when-ads-start-fatiguing —
 *   frequency above 2.5–3.0 is the "danger zone" for cold-audience feed/story placements, above
 *   4.0 is "critical".
 * - GoodMorningCo, "What Is Creative Fatigue in Meta Ads? Frequency 2.5 vs 3.5" —
 *   https://goodmorningco.com/blog/what-is-creative-fatigue-meta-ads-frequency-thresholds —
 *   corroborates the same 2.5–3.5 warning band.
 *
 * `FREQUENCY_HIGH_MEDIUM_THRESHOLD` (3.5, matching the codebase's existing constant) marks the
 * MEDIUM severity floor; `FREQUENCY_HIGH_SEVERE_THRESHOLD` (4.5, matching `CreativeBriefBuilder`'s
 * own HIGH-urgency tier) marks HIGH severity.
 */

/** Minimal, real, already-available per-ad input — no dependency on this package's richer `PerAdFinding` (which doesn't carry `frequency`/a display name) or on `@aos/meta-ads-connector`'s `Ad` entity directly, keeping this class trivially unit-testable. */
export interface AdFrequencySignal {
  readonly adId: string;
  readonly adName: string;
  readonly frequency: number;
}

export type AnomalySeverity = "HIGH" | "MEDIUM";

export interface FrequencyHighAnomaly {
  readonly anomalyType: "FREQUENCY_HIGH";
  readonly adId: string;
  readonly adName: string;
  readonly severity: AnomalySeverity;
  readonly frequency: number;
  /** Real, Indonesian, ready-to-render message — same "one real sentence per real signal" discipline `IntelligenceService`'s `buildDigestText` already establishes. */
  readonly message: string;
}

/** MEDIUM severity floor — see class docstring for the real, cited research + this codebase's own precedent behind this exact number. */
export const FREQUENCY_HIGH_MEDIUM_THRESHOLD = 3.5;
/** HIGH severity floor — matches `CreativeBriefBuilder.urgencyFor`'s own HIGH-urgency tier. */
export const FREQUENCY_HIGH_SEVERE_THRESHOLD = 4.5;

/**
 * Real sibling to `CampaignHealthAnalyzer` (portfolio-level SCALE/KEEP/.../PAUSE verdict health
 * score) — this class instead flags individual ads whose real `frequency` has crossed a real
 * fatigue threshold, a per-ad anomaly list rather than a portfolio score.
 */
export class AnomalyDetector {
  /** Flags every ad whose real `frequency` exceeds `FREQUENCY_HIGH_MEDIUM_THRESHOLD`, sorted by descending frequency (worst first). Empty input → empty, honest output — never a fabricated anomaly. */
  static detectFrequencyHigh(
    ads: ReadonlyArray<AdFrequencySignal>,
  ): ReadonlyArray<FrequencyHighAnomaly> {
    const anomalies: FrequencyHighAnomaly[] = [];
    for (const ad of ads) {
      if (ad.frequency <= FREQUENCY_HIGH_MEDIUM_THRESHOLD) {
        continue;
      }
      const severity: AnomalySeverity =
        ad.frequency > FREQUENCY_HIGH_SEVERE_THRESHOLD ? "HIGH" : "MEDIUM";
      anomalies.push({
        anomalyType: "FREQUENCY_HIGH",
        adId: ad.adId,
        adName: ad.adName,
        severity,
        frequency: ad.frequency,
        message: `Frequency ${ad.frequency.toFixed(1)}x — iklan mulai jenuh. Pertimbangkan ganti creative.`,
      });
    }
    return anomalies.sort((a, b) => b.frequency - a.frequency);
  }
}
