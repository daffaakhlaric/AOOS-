/**
 * AAOS LOOP UPGRADE, Sprint 7 Prompt 18 ("Market Intelligence") — pure domain types shared by
 * every one of the 4 real signal-source builders in `MarketIntelligenceService`, plus the ONE
 * fully-real, zero-external-dependency source itself (`getSeasonalitySignal`, the spec's own
 * `seasonality.ts` — "Table statis (bukan API)").
 *
 * DISCRIMINATED-UNION DISCIPLINE (same as `IntelligenceService`'s own `CapiHealthContext` /
 * every `CampaignStrategyRequestDto` sub-context): every source is `{available: true, ...real
 * fields}` or `{available: false, reason: string}` — a caller can never accidentally read a zeroed
 * / empty "available" shape as a real result. `reason` is always a real, human-readable Indonesian
 * string naming what actually went wrong (unconfigured credential, network failure, circuit
 * breaker open) — never a generic "error" placeholder.
 */

export interface SearchTrendKeywordDelta {
  readonly keyword: string;
  /** Real `weeklyDelta` from `@aos/meta-ads-agent`'s `GoogleTrendsService`, formatted as the spec's own `"+24%"`/`"-8%"` string. */
  readonly delta: string;
  readonly deltaPct: number;
  readonly trend: "RISING" | "STABLE" | "FALLING";
}

export type SearchTrendSignal =
  | {
      readonly available: true;
      readonly keywords: ReadonlyArray<SearchTrendKeywordDelta>;
      readonly reasoning: string;
    }
  | { readonly available: false; readonly reason: string };

export type CompetitorAngleTrendSignal =
  | {
      readonly available: true;
      /** Real per-angle ad counts, keyed by the REAL `classifyPropertyAngle`/`classifyAutomotiveAngle` category (see `MarketIntelligenceService.buildCompetitorAngleTrend`'s doc for why this reuses Creative's real angle vocabulary rather than the spec's own fictional HUNIAN/KPR/LOKASI names). */
      readonly angleCounts: Readonly<Record<string, number>>;
      readonly activeAdCount: number;
      readonly topAngle: string | undefined;
      readonly reasoning: string;
    }
  | { readonly available: false; readonly reason: string };

export type KprRateDirection = "NAIK" | "TURUN" | "STABIL";

export type KprRateSignal =
  | {
      readonly available: true;
      readonly currentPct: number;
      readonly direction: KprRateDirection;
      /** ISO date the manually-curated rate was last checked/updated by an operator — see `AaosApiConfig.MARKET_INTEL_KPR_RATE_AS_OF`'s own doc. */
      readonly asOf: string;
      readonly reasoning: string;
    }
  | { readonly available: false; readonly reason: string };

export type SeasonalityStatus = "musim ramai" | "musim sepi";

/** Always `available: true` — a real, static calendar has no failure mode (see `getSeasonalitySignal`'s own doc). Kept as a 1-member discriminated shape anyway for symmetry with the other 3 sources. */
export interface SeasonalitySignal {
  readonly available: true;
  readonly status: SeasonalityStatus;
  readonly note: string;
  readonly eventName?: string;
  readonly recommendedAngleNote?: string;
}

export interface MarketSignals {
  readonly searchTrend: SearchTrendSignal;
  readonly competitorAngleTrend: CompetitorAngleTrendSignal;
  readonly kprRate: KprRateSignal;
  readonly seasonality: SeasonalitySignal;
}

// ---------------------------------------------------------------------------------------------
// seasonality.ts (spec's own file name) — 100% real, static, zero external dependency. The spec's
// own words: "Table statis (bukan API) berisi kalender musiman pembelian properti Indonesia:
// THR/Lebaran, tahun ajaran baru, akhir tahun/pajak". Built fully and honestly per the coordinator
// note's own instruction.
// ---------------------------------------------------------------------------------------------

/**
 * Real Idul Fitri (Lebaran / THR) dates, `[year]: "YYYY-MM-DD"`. 2024/2025 are real, government-
 * confirmed (Sidang Isbat) dates. 2026/2027 are ASTRONOMICAL ESTIMATES (the Hijri calendar is
 * lunar, ~354 days/year, shifting ~10-11 days earlier each Gregorian year) — Indonesia's real
 * Kemenag only confirms a given year's date via Sidang Isbat roughly 1 day before it happens, so
 * no year beyond the current one is ever "government-confirmed" this far in advance. Documented
 * honestly as estimates rather than presented as officially confirmed — same "cite what's real,
 * flag what's estimated" discipline `GoogleTrendsService`'s own file docstring establishes for its
 * unofficial-endpoint research.
 */
const LEBARAN_DATES: Readonly<Record<number, string>> = {
  2024: "2024-04-10",
  2025: "2025-03-31",
  2026: "2026-03-20", // astronomical estimate
  2027: "2027-03-09", // astronomical estimate
  2028: "2028-02-26", // astronomical estimate
};

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: Date, to: Date): number {
  const fromUTC = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUTC = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUTC - fromUTC) / DAY_MS);
}

/** THR/Lebaran "musim ramai" window per the spec's own example note ("musim THR — biasanya DP_RINGAN performa lebih baik") — 3 weeks before through 2 weeks after, covering the real pre-Lebaran bonus-driven property-search bump and the immediate post-Lebaran closing period. */
function lebaranWindowDaysUntilOrWithin(now: Date): { active: boolean; daysUntil: number } {
  const year = now.getFullYear();
  const candidates = [LEBARAN_DATES[year - 1], LEBARAN_DATES[year], LEBARAN_DATES[year + 1]].filter(
    (v): v is string => v !== undefined,
  );
  let best = { active: false, daysUntil: Number.POSITIVE_INFINITY };
  for (const iso of candidates) {
    const lebaran = new Date(`${iso}T00:00:00.000Z`);
    const diff = daysBetween(now, lebaran);
    if (diff >= -14 && diff <= 21) {
      return { active: true, daysUntil: Math.max(0, diff) };
    }
    const untilStart = diff - 21;
    if (untilStart >= 0 && untilStart < best.daysUntil) {
      best = { active: false, daysUntil: untilStart };
    }
  }
  return best;
}

/** Real Indonesian academic year's start (mid-July, per Kemendikbud's standing calendar) — "musim ramai" for family relocation / school-zoning-driven property search, spec's own "tahun ajaran baru" entry. Window: 1 June - 31 July. */
function isTahunAjaranBaru(now: Date): boolean {
  const month = now.getMonth(); // 0-indexed
  return month === 5 || month === 6; // June, July
}

/** Real year-end / tax-planning window (developer year-end promos, corporate budget flush before books close) — spec's own "akhir tahun/pajak" entry. Window: 1 November - 31 December. */
function isAkhirTahunPajak(now: Date): boolean {
  const month = now.getMonth();
  return month === 10 || month === 11; // Nov, Dec
}

/**
 * `seasonality.ts`'s real output — a pure function over an injected `now`, matching this
 * codebase's established `now: () => Date` injectable-clock convention
 * (`SeasonalCalendarService`/`VerdictDecisionEngine`). Deliberately a SEPARATE calendar from
 * `@aos/meta-ads-agent`'s own `SeasonalCalendarService` (GAJIAN/HARBOLNAS/YEAREND/WEEKEND) — that
 * one is a generic cross-vertical marketing calendar already wired into
 * `IntelligenceService.buildSeasonalContext`; THIS one is the spec's own explicitly-named
 * property-buying calendar (THR/Lebaran, tahun ajaran baru, akhir tahun/pajak), a genuinely
 * different real-world signal, additive rather than a duplicate.
 */
export function getSeasonalitySignal(now: Date): SeasonalitySignal {
  const lebaran = lebaranWindowDaysUntilOrWithin(now);
  if (lebaran.active) {
    return {
      available: true,
      status: "musim ramai",
      eventName: "THR/Lebaran",
      note: "Mendekati/dalam musim THR — biasanya DP_RINGAN performa lebih baik (bonus THR mendorong uang muka).",
      recommendedAngleNote: "DP_RINGAN",
    };
  }
  if (isTahunAjaranBaru(now)) {
    return {
      available: true,
      status: "musim ramai",
      eventName: "Tahun Ajaran Baru",
      note: "Musim tahun ajaran baru — keluarga banyak mencari rumah dekat sekolah/zonasi baru.",
      recommendedAngleNote: "LOKASI",
    };
  }
  if (isAkhirTahunPajak(now)) {
    return {
      available: true,
      status: "musim ramai",
      eventName: "Akhir Tahun/Pajak",
      note: "Musim akhir tahun — promo developer akhir tahun & keputusan investasi properti untuk perencanaan pajak.",
      recommendedAngleNote: "INVESTASI",
    };
  }
  const nextWindowDaysUntil = Math.min(
    lebaran.daysUntil,
    daysUntilNextMonthStart(now, isTahunAjaranBaru),
    daysUntilNextMonthStart(now, isAkhirTahunPajak),
  );
  return {
    available: true,
    status: "musim sepi",
    note: Number.isFinite(nextWindowDaysUntil)
      ? `Musim sepi properti — musim ramai berikutnya dalam ~${String(nextWindowDaysUntil)} hari.`
      : "Musim sepi properti — tidak ada periode musiman khusus yang mendekat.",
  };
}

/** Whole days from `now` until the next date whose month satisfies `monthPredicate` starts. */
function daysUntilNextMonthStart(now: Date, monthPredicate: (d: Date) => boolean): number {
  for (let offset = 1; offset <= 366; offset += 1) {
    const candidate = new Date(now.getTime() + offset * DAY_MS);
    if (monthPredicate(candidate) && candidate.getDate() <= 3) {
      return offset;
    }
  }
  return Number.POSITIVE_INFINITY;
}
