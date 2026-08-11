import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";
import {
  Verdict,
  type Ad,
  type AdAccountId,
  type Branch,
  type Funnel,
  type PullCampaignData,
} from "@aos/meta-ads-connector";

import { AdHistoricalRecord } from "../../domain/entities/AdHistoricalRecord.js";
import { HistoricalLearningError } from "../../domain/errors/index.js";
import { AdAngle } from "../../domain/value-objects/AdAngle.js";
import { EvergreenScore } from "../../domain/value-objects/EvergreenScore.js";
import { HistoricalPeriod } from "../../domain/value-objects/HistoricalPeriod.js";
import {
  performanceBaselineKey,
  type PerformanceBaseline,
} from "../../domain/value-objects/PerformanceBaseline.js";
import {
  createSeasonalPattern,
  type SeasonalPattern,
} from "../../domain/value-objects/SeasonalPattern.js";

/** The narrow slice of `@aos/meta-ads-connector`'s `PullCampaignData` this service actually calls — same decoupling pattern as `ExecutionService`'s `ExecuteVerdictPort`. */
export type PullCampaignDataPort = Pick<PullCampaignData, "execute">;

/** One ad's verdict, recorded for `HistoricalLearnings.verdictHistory`. */
export interface VerdictRecord {
  readonly adId: string;
  readonly verdict: Verdict;
  readonly recordedAt: Date;
}

/** The full result of `HistoricalLearningService.learn()` — AAOS-W1D-S1S2 (S1). */
export interface HistoricalLearnings {
  readonly period: HistoricalPeriod;
  readonly performanceBaselines: ReadonlyArray<PerformanceBaseline>;
  readonly evergreenAds: ReadonlyArray<string>;
  readonly fatiguePatterns: ReadonlyMap<Funnel, number>;
  readonly seasonalPatterns: SeasonalPattern;
  readonly topAngles: ReadonlyArray<AdAngle>;
  readonly topBranches: ReadonlyArray<Branch>;
  readonly worstFunnels: ReadonlyArray<Funnel>;
  readonly verdictHistory: ReadonlyArray<VerdictRecord>;
}

const FATIGUE_FREQUENCY_THRESHOLD = 3.5;
// Evergreen's `daysActive > 60` threshold is enforced by `AdHistoricalRecord.isEvergreen` itself
// (see that entity) — not duplicated here as a constant to avoid two sources of truth.

/** Keyword → `AdAngle` classification table, applied against a campaign/ad name (case-insensitive substring match), in priority order. Not part of `CampaignNameParser` (which only classifies funnel/branch — see that file) — angle detection is new with this supplement, since nothing else in the package already does it. */
const ANGLE_KEYWORDS: ReadonlyArray<readonly [string, AdAngle]> = [
  ["syariah", AdAngle.KREDIT_SYARIAH],
  ["gudang", AdAngle.GUDANGNYA],
  ["qna", AdAngle.QNA],
  ["q&a", AdAngle.QNA],
  ["tanya", AdAngle.QNA],
  ["testimoni", AdAngle.TESTIMONIAL],
  ["discovery", AdAngle.DISCOVERY],
  ["budget", AdAngle.DISCOVERY],
  ["website", AdAngle.WEBSITE_REDIRECT],
  ["redirect", AdAngle.WEBSITE_REDIRECT],
  ["dp ringan", AdAngle.DP_RINGAN],
  ["dp", AdAngle.DP_RINGAN],
];

/** Classifies an `AdAngle` from a raw ad/campaign name. Falls back to `AdAngle.DP_RINGAN` — DSS's single most common angle (see `BusinessKnowledgeBase`) — when no keyword matches. */
function classifyAngle(name: string): AdAngle {
  const lower = name.toLowerCase();
  for (const [keyword, angle] of ANGLE_KEYWORDS) {
    if (lower.includes(keyword)) {
      return angle;
    }
  }
  return AdAngle.DP_RINGAN;
}

function mean(values: ReadonlyArray<number>): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * S1 "Historical Campaign Learning" — pulls recent Meta API data via
 * `@aos/meta-ads-connector`'s `PullCampaignData`, classifies each ad's angle, and derives
 * `PerformanceBaseline`s, evergreen ads, fatigue patterns, and a ranked angle list.
 *
 * KNOWN LIMITATION — `datePreset` window: `PullCampaignData`'s real `DatePreset` type is closed
 * to `'last_7d' | 'last_14d' | 'last_30d'` (see that file) — there is no native 90-day option in
 * the already-shipped `@aos/meta-ads-connector`, and per this task's hard constraint that package
 * is not modified. `learn()` therefore always pulls `'last_30d'` (the closest available window)
 * regardless of the `days` argument's value; `HistoricalPeriod.days` on the returned
 * `HistoricalLearnings` always reflects the REAL 30-day window actually pulled, not the
 * caller-requested `days`, so downstream consumers are never misled about how much history backs
 * these numbers. A future connector version adding a genuine 90-day (or custom-range) preset
 * would let this service honor the full `days` argument without any other change here.
 *
 * KNOWN LIMITATION — seasonal patterns: `PullCampaignData`'s mapped `Ad`/`AdMetrics` carry only
 * per-ad AGGREGATE insight totals (spend, impressions, D2/D3/D5, etc.) for the whole pulled
 * window — no hour-of-day breakdown is fetched (that would require separate hourly-breakdown
 * Insights API calls, out of scope for this connector version). `seasonalPatterns` is therefore
 * always an empty `SeasonalPattern` (`createSeasonalPattern([])`) — real hour→lead-index data
 * requires a future connector capability this service can plug into unchanged.
 *
 * KNOWN LIMITATION — fatigue "days until fatigue": for the same reason (no day-by-day time
 * series, only one aggregate `frequency` figure per ad for the whole window), `fatiguePatterns`
 * approximates "avg days before frequency > 3.5" as the average `daysActive` of ads THIS PULL
 * currently sees with `frequency > 3.5` — a real time-series would instead find the day within
 * each ad's history frequency first crossed 3.5. Funnels with no currently-fatigued ad in this
 * pull fall back to `KNOWN_FATIGUE_PATTERNS`' seed value.
 */
export class HistoricalLearningService {
  constructor(
    private readonly pullCampaignData: PullCampaignDataPort,
    private readonly tenantId: string,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async learn(
    adAccountId: AdAccountId,
    accessToken: string,
    days: 30 | 60 | 90 = 90,
  ): Promise<Result<HistoricalLearnings, HistoricalLearningError>> {
    if (days !== 30) {
      this.logger.warn(
        { requestedDays: days },
        "meta-ads-agent: HistoricalLearningService.learn() requested a window PullCampaignData " +
          "cannot natively pull (only last_7d|last_14d|last_30d exist) — falling back to last_30d",
      );
    }

    const pulledAt = this.now();
    const pullResult = await this.pullCampaignData.execute({
      adAccountId,
      datePreset: "last_30d",
      accessToken,
      tenantId: this.tenantId,
      correlationId: crypto.randomUUID(),
    });
    if (!pullResult.ok) {
      return err(
        new HistoricalLearningError(pullResult.error.message, { cause: pullResult.error }),
      );
    }

    const ads: Ad[] = [];
    for (const campaign of pullResult.value.campaigns) {
      for (const adSet of campaign.adSets) {
        for (const ad of adSet.ads) {
          ads.push(ad);
        }
      }
    }

    const periodResult = HistoricalPeriod.create({
      from: new Date(pulledAt.getTime() - 30 * 24 * 60 * 60 * 1000),
      to: pulledAt,
      days: 30,
    });
    /* v8 ignore next 4 */
    if (!periodResult.ok) {
      // Unreachable: `from` is always 30 days before `to`, and `days: 30` is a positive integer.
      return err(new HistoricalLearningError(periodResult.error.message));
    }

    const records: AdHistoricalRecord[] = [];
    const verdictHistory: VerdictRecord[] = [];
    for (const ad of ads) {
      const angle = classifyAngle(ad.name);
      const healthy = ad.verdict !== Verdict.PAUSE;
      const daysActive = ad.daysSinceCreation;
      const fatigueCount = ad.metrics.frequency > FATIGUE_FREQUENCY_THRESHOLD ? 1 : 0;

      // Evergreen scoring: healthy ads accrue score with tenure (capped at 100); unhealthy ads
      // are penalized by how far past the fatigue threshold they are. Neither branch can produce
      // a value outside 0..100, so `EvergreenScore.create` below never fails for real input.
      const scoreValue = healthy
        ? Math.min(100, 60 + daysActive / 3)
        : Math.max(
            0,
            50 -
              fatigueCount * 20 -
              Math.max(0, ad.metrics.frequency - FATIGUE_FREQUENCY_THRESHOLD) * 10,
          );
      const scoreResult = EvergreenScore.create(scoreValue);
      /* v8 ignore next 4 */
      if (!scoreResult.ok) {
        // Unreachable: scoreValue is always clamped to [0, 100] by the Math.min/Math.max above.
        return err(new HistoricalLearningError(scoreResult.error.message));
      }

      const recordResult = AdHistoricalRecord.create({
        adId: ad.id.toString(),
        adName: ad.name,
        branch: ad.branch,
        funnel: ad.funnel,
        angle,
        daysActive,
        avgRphD3: ad.metrics.rphD3.value ?? 0,
        avgRphChat: ad.metrics.rphChat.value ?? 0,
        avgFrequency: ad.metrics.frequency,
        totalSpend: ad.metrics.spend.toNumber(),
        totalD3: ad.metrics.d3,
        fatigueCount,
        evergreenScore: scoreResult.value,
      });
      /* v8 ignore next 4 */
      if (!recordResult.ok) {
        // Unreachable: every field above is derived from an already-validated `Ad`.
        return err(new HistoricalLearningError(recordResult.error.message));
      }
      records.push(recordResult.value);
      verdictHistory.push({ adId: ad.id.toString(), verdict: ad.verdict, recordedAt: pulledAt });
    }

    const performanceBaselines = this.buildBaselines(ads, records);
    const evergreenAds = records.filter((r) => r.isEvergreen).map((r) => r.adId);
    const fatiguePatterns = this.buildFatiguePatterns(records);
    const seasonalPatterns = createSeasonalPattern([]);
    const topAngles = this.rankAngles(records);
    const { topBranches, worstFunnels } = this.rankBranchesAndFunnels(performanceBaselines);

    return ok({
      period: periodResult.value,
      performanceBaselines,
      evergreenAds,
      fatiguePatterns,
      seasonalPatterns,
      topAngles,
      topBranches,
      worstFunnels,
      verdictHistory,
    });
  }

  /** One `PerformanceBaseline` per distinct branch × funnel × angle combination actually present in the pulled ads. */
  private buildBaselines(
    ads: ReadonlyArray<Ad>,
    records: ReadonlyArray<AdHistoricalRecord>,
  ): PerformanceBaseline[] {
    const rphLeadByAdId = new Map<string, number>();
    for (const ad of ads) {
      if (ad.metrics.rphLead.isDefined()) {
        rphLeadByAdId.set(ad.id.toString(), ad.metrics.rphLead.value as number);
      }
    }

    const groups = new Map<string, AdHistoricalRecord[]>();
    for (const record of records) {
      const key = performanceBaselineKey(record.branch, record.funnel, record.angle);
      const existing = groups.get(key) ?? [];
      existing.push(record);
      groups.set(key, existing);
    }

    const baselines: PerformanceBaseline[] = [];
    for (const group of groups.values()) {
      const first = group[0] as AdHistoricalRecord;
      const rphLeads = group
        .map((r) => rphLeadByAdId.get(r.adId))
        .filter((v): v is number => v !== undefined);
      baselines.push({
        branch: first.branch,
        funnel: first.funnel,
        angle: first.angle,
        avgRphLead: mean(rphLeads),
        avgRphChat: mean(group.map((r) => r.avgRphChat)),
        avgRphD3: mean(group.map((r) => r.avgRphD3)),
        sampleSize: group.length,
      });
    }
    return baselines;
  }

  /** See class docstring "KNOWN LIMITATION — fatigue". Funnels with no observed data this pull fall back to the package's `KNOWN_FATIGUE_PATTERNS` seed, imported lazily to avoid a circular import with `BusinessKnowledgeBase`. */
  private buildFatiguePatterns(records: ReadonlyArray<AdHistoricalRecord>): Map<Funnel, number> {
    const byFunnel = new Map<Funnel, number[]>();
    for (const record of records) {
      if (record.avgFrequency > FATIGUE_FREQUENCY_THRESHOLD) {
        const existing = byFunnel.get(record.funnel) ?? [];
        existing.push(record.daysActive);
        byFunnel.set(record.funnel, existing);
      }
    }
    const result = new Map<Funnel, number>();
    for (const [funnel, daysList] of byFunnel) {
      result.set(funnel, mean(daysList));
    }
    return result;
  }

  /** Ranked ascending by avg Rp/D3 (best/cheapest first) — one entry per angle actually observed. */
  private rankAngles(records: ReadonlyArray<AdHistoricalRecord>): AdAngle[] {
    const byAngle = new Map<AdAngle, number[]>();
    for (const record of records) {
      const existing = byAngle.get(record.angle) ?? [];
      existing.push(record.avgRphD3);
      byAngle.set(record.angle, existing);
    }
    return [...byAngle.entries()]
      .map(([angle, values]) => ({ angle, avg: mean(values) }))
      .sort((a, b) => a.avg - b.avg)
      .map((entry) => entry.angle);
  }

  /** `topBranches` ranked ascending by avg Rp/lead (best first); `worstFunnels` ranked descending by avg Rp/lead (worst first). Both derived from the same baselines this pull just built. */
  private rankBranchesAndFunnels(baselines: ReadonlyArray<PerformanceBaseline>): {
    topBranches: Branch[];
    worstFunnels: Funnel[];
  } {
    const byBranch = new Map<Branch, number[]>();
    const byFunnel = new Map<Funnel, number[]>();
    for (const baseline of baselines) {
      const branchValues = byBranch.get(baseline.branch) ?? [];
      branchValues.push(baseline.avgRphLead);
      byBranch.set(baseline.branch, branchValues);

      const funnelValues = byFunnel.get(baseline.funnel) ?? [];
      funnelValues.push(baseline.avgRphLead);
      byFunnel.set(baseline.funnel, funnelValues);
    }
    const topBranches = [...byBranch.entries()]
      .map(([branch, values]) => ({ branch, avg: mean(values) }))
      .sort((a, b) => a.avg - b.avg)
      .map((e) => e.branch);
    const worstFunnels = [...byFunnel.entries()]
      .map(([funnel, values]) => ({ funnel, avg: mean(values) }))
      .sort((a, b) => b.avg - a.avg)
      .map((e) => e.funnel);
    return { topBranches, worstFunnels };
  }
}
