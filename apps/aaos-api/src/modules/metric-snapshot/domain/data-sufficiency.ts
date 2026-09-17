/**
 * EYVRA — SAMANTHA V2 Phase 1 Part B (first half). Pure, deterministic classification of how much
 * a `MetricSnapshotDto` can honestly be trusted, given how much real data actually backs it.
 *
 * WHY THESE THRESHOLDS: a ratio metric (CTR, CPL) computed from a tiny sample swings wildly as new
 * data arrives — a single extra click on a 200-impression sample can move CTR by 0.5 points, while
 * the same click on a 20,000-impression sample is noise. `impressions`/`leads` are used as the real
 * proxies for sample size (the same counters `aggregate-insights.ts` sums), and `daysCovered` gates
 * separately because even a large SINGLE day of data cannot honestly stand in for a "last 7 days"
 * trend — see `daysCovered`'s own doc on `MetricSnapshotDto` for why it's the count of distinct
 * dates actually present, never the window's nominal length. The specific numbers below are the
 * same rough order-of-magnitude minimums standard marketing-analytics practice treats as "too early
 * to trust" (roughly: hundreds of impressions is noise, thousands is a starting signal, tens of
 * thousands is stable) — deterministic and documented, not derived from a formal statistical test
 * this codebase has no data to calibrate.
 */

export interface SampleSize {
  readonly impressions: number;
  readonly clicks: number;
  readonly leads: number;
}

export type DataSufficiencyLevel = "INSUFFICIENT" | "LOW" | "MEDIUM" | "HIGH";

export interface DataSufficiencyResult {
  readonly level: DataSufficiencyLevel;
  /** `0`-`100`, a real continuous function of `sampleSize`/`daysCovered` (see `computeScore` below) — never a bare level-to-number lookup table. */
  readonly score: number;
  /** Specific, named reasons the level isn't higher. Empty at `HIGH` — nothing is failing. */
  readonly reasons: readonly string[];
}

export const INSUFFICIENT_IMPRESSIONS_THRESHOLD = 1_000;
export const INSUFFICIENT_DAYS_THRESHOLD = 2;
export const LOW_IMPRESSIONS_THRESHOLD = 5_000;
export const LOW_LEADS_THRESHOLD = 10;
export const MEDIUM_IMPRESSIONS_THRESHOLD = 20_000;
export const MEDIUM_LEADS_THRESHOLD = 30;
/** Days-covered component of the score caps out at a full "last 7 days" window of real data. */
const SCORE_DAYS_CAP = 7;

/**
 * `0`-`100`, graduated (not a level lookup): impressions contribute up to 50 points (scaled against
 * the MEDIUM impressions threshold — the point beyond which more impressions stop meaningfully
 * changing CTR/CPM stability), leads contribute up to 30 points (scaled against the MEDIUM leads
 * threshold — CPL's real stability driver), and days-covered contributes up to 20 points (scaled
 * against a full 7-day window). Each component is independently capped at its own share so a very
 * large single-day spend can never fully substitute for genuine multi-day coverage.
 */
function computeScore(sampleSize: SampleSize, daysCovered: number): number {
  const impressionsComponent =
    Math.min(sampleSize.impressions / MEDIUM_IMPRESSIONS_THRESHOLD, 1) * 50;
  const leadsComponent = Math.min(sampleSize.leads / MEDIUM_LEADS_THRESHOLD, 1) * 30;
  const daysComponent = Math.min(Math.max(daysCovered, 0) / SCORE_DAYS_CAP, 1) * 20;
  return Math.round(impressionsComponent + leadsComponent + daysComponent);
}

export function assessDataSufficiency(
  sampleSize: SampleSize,
  daysCovered: number,
): DataSufficiencyResult {
  const { impressions, leads } = sampleSize;
  const score = computeScore(sampleSize, daysCovered);

  const insufficientReasons: string[] = [];
  if (impressions < INSUFFICIENT_IMPRESSIONS_THRESHOLD) {
    insufficientReasons.push(
      `Impressions baru ${String(impressions)} — di bawah ambang minimum ${String(INSUFFICIENT_IMPRESSIONS_THRESHOLD)} untuk statistik yang bisa diandalkan.`,
    );
  }
  if (daysCovered < INSUFFICIENT_DAYS_THRESHOLD) {
    insufficientReasons.push(
      `Hanya ${String(daysCovered)} hari data tersinkron — minimal ${String(INSUFFICIENT_DAYS_THRESHOLD)} hari diperlukan sebelum tren bisa dibaca.`,
    );
  }
  if (insufficientReasons.length > 0) {
    return { level: "INSUFFICIENT", score, reasons: insufficientReasons };
  }

  const lowReasons: string[] = [];
  if (impressions < LOW_IMPRESSIONS_THRESHOLD) {
    lowReasons.push(
      `Impressions ${String(impressions)} masih di bawah ${String(LOW_IMPRESSIONS_THRESHOLD)} — CTR bisa berubah signifikan seiring data bertambah.`,
    );
  }
  if (leads < LOW_LEADS_THRESHOLD) {
    lowReasons.push(
      `Leads baru ${String(leads)} — di bawah ${String(LOW_LEADS_THRESHOLD)}, CPL belum stabil.`,
    );
  }
  if (lowReasons.length > 0) {
    return { level: "LOW", score, reasons: lowReasons };
  }

  const mediumReasons: string[] = [];
  if (impressions < MEDIUM_IMPRESSIONS_THRESHOLD) {
    mediumReasons.push(
      `Impressions ${String(impressions)} di bawah ${String(MEDIUM_IMPRESSIONS_THRESHOLD)} untuk tingkat keyakinan tinggi.`,
    );
  }
  if (leads < MEDIUM_LEADS_THRESHOLD) {
    mediumReasons.push(
      `Leads ${String(leads)} di bawah ${String(MEDIUM_LEADS_THRESHOLD)} untuk tingkat keyakinan tinggi.`,
    );
  }
  if (mediumReasons.length > 0) {
    return { level: "MEDIUM", score, reasons: mediumReasons };
  }

  return { level: "HIGH", score, reasons: [] };
}
