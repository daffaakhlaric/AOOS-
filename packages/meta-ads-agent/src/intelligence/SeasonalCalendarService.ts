import { AdAngle } from "../domain/value-objects/AdAngle.js";

/**
 * AAOS-TAMARA-INTELLIGENCE-LAYER Phase 1 ("Source 3: Seasonal Calendar"). Zero external
 * dependency — pure, hardcoded calendar-date logic, matching this package's established
 * `now: () => Date` injectable-clock convention (see `VerdictDecisionEngine`).
 *
 * This package has no shared cross-vertical `Vertical` enum (see `tenants.vertical`'s own
 * "free TEXT, not a shared enum" precedent in `apps/aaos-api`'s migrations) — `IntelVertical` is
 * a small local union scoped to this file's own needs.
 */
export type IntelVertical = "AUTOMOTIVE" | "PROPERTY";

export type SeasonalEventType = "GAJIAN" | "HARBOLNAS" | "YEAREND" | "WEEKEND";

/**
 * Real angle members per vertical. `AUTOMOTIVE` is strongly typed against this package's real
 * `AdAngle` enum (`packages/meta-ads-agent/src/domain/value-objects/AdAngle.ts` — 7 members:
 * `DP_RINGAN, KREDIT_SYARIAH, GUDANGNYA, QNA, DISCOVERY, TESTIMONIAL, WEBSITE_REDIRECT`).
 *
 * `PROPERTY` is deliberately `ReadonlyArray<string>`, NOT typed against
 * `@aos/creative-agent`'s `PropertyAdAngle` enum (8 members: `DP_RINGAN, READY_HUNI, INVESTASI,
 * EXCLUSIVE, SYARIAH, PROMO_TERBATAS, TESTIMONIAL, VIRTUAL_TOUR`) — `@aos/creative-agent`
 * already depends on `@aos/meta-ads-agent` (see its `package.json`), so importing
 * `PropertyAdAngle` back into this package would create a workspace dependency cycle.
 * `PropertyAdAngle.ts`'s own docstring documents the same "PROPERTY gets its own angle
 * vocabulary, not a shared one" reasoning for why the two enums are kept separate in the first
 * place. The literal strings below are kept byte-identical to `PropertyAdAngle`'s real member
 * names so a caller holding both can safely do `value as PropertyAdAngle` if it needs the typed
 * form.
 */
export interface SeasonalEventAngles {
  readonly AUTOMOTIVE: ReadonlyArray<AdAngle>;
  readonly PROPERTY: ReadonlyArray<string>;
}

export interface SeasonalEvent {
  readonly name: string;
  readonly type: SeasonalEventType;
  readonly budgetMultiplier: number;
  readonly priority: "HIGH" | "MEDIUM" | "LOW";
  readonly recommendedAngles: SeasonalEventAngles;
  /** Whether `date` falls within this event's active window. */
  readonly isActive: (date: Date) => boolean;
  /** Whole calendar days until this event's NEXT occurrence starts, relative to `date`. `0` when already active. */
  readonly daysUntilNextStart: (date: Date) => number;
}

export interface SeasonalRecommendation {
  readonly isSpecialPeriod: boolean;
  readonly eventName?: string;
  readonly budgetMultiplier?: number;
  readonly upcomingEvent?: string;
  readonly daysUntil?: number;
  readonly recommendedAngles?: ReadonlyArray<AdAngle> | ReadonlyArray<string>;
  readonly reasoning: string;
}

/** Whole calendar days from `from` to `to` (date-only, ignores time-of-day) — always >= 0 for `to >= from` by this file's own construction. */
function daysBetweenDates(from: Date, to: Date): number {
  const fromUTC = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUTC = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUTC - fromUTC) / (24 * 60 * 60 * 1000));
}

/**
 * `GAJIAN` — Indonesian monthly payday period, spec's "tiap bulan tgl 25 s/d tgl 2 bulan depan".
 * Wraps a month boundary every occurrence (unlike the other 3 event types below), so it needs its
 * own matcher rather than the shared `inAnnualRange`/`daysUntilNextAnnual` helpers.
 */
function isGajianActive(date: Date): boolean {
  const day = date.getDate();
  return day >= 25 || day <= 2;
}

/** When inactive, `date.getDate()` is always within `[3, 24]` (see `isGajianActive`), so the 25th of the SAME month is always still in the future — no month-wraparound case to handle here. */
function daysUntilNextGajianStart(date: Date): number {
  if (isGajianActive(date)) {
    return 0;
  }
  const target = new Date(date.getFullYear(), date.getMonth(), 25);
  return daysBetweenDates(date, target);
}

/** `date` (calendar day only) falls within `[startMonth-startDay, endMonth-endDay]` of `date`'s own year. Only used for ranges that don't cross a year boundary (Harbolnas, year-end bonus). */
function inAnnualRange(
  date: Date,
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay: number,
): boolean {
  const year = date.getFullYear();
  const start = new Date(year, startMonth - 1, startDay, 0, 0, 0, 0);
  const end = new Date(year, endMonth - 1, endDay, 23, 59, 59, 999);
  return date >= start && date <= end;
}

/** Days until the next occurrence of an annual `startMonth`/`startDay` window — this year's if still upcoming, else next year's. */
function daysUntilNextAnnual(
  date: Date,
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay: number,
): number {
  if (inAnnualRange(date, startMonth, startDay, endMonth, endDay)) {
    return 0;
  }
  const year = date.getFullYear();
  const startOfToday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  let target = new Date(year, startMonth - 1, startDay);
  if (target < startOfToday) {
    target = new Date(year + 1, startMonth - 1, startDay);
  }
  return daysBetweenDates(date, target);
}

function isWeekendActive(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Inactive days are always Mon(1)..Fri(5) (see `isWeekendActive`), so `(6 - date.getDay() + 7) %
 * 7` is always within `[1, 5]` here — the `% 7 === 0` case (which would only occur for a Saturday
 * itself) is structurally unreachable, since `isWeekendActive` already returns `true` for
 * Saturday and short-circuits above.
 */
function daysUntilNextWeekendStart(date: Date): number {
  if (isWeekendActive(date)) {
    return 0;
  }
  return (6 - date.getDay() + 7) % 7;
}

/**
 * The spec's `SEASONAL_EVENTS`, corrected for reality (see this package's own coordinator note,
 * point 3 of the wider effort, and the file-level docstring above for the angle-mapping
 * rationale). Each event's `recommendedAngles` maps the spec's fictional angle names (which exist
 * in neither real `AdAngle` nor real `PropertyAdAngle`) to the closest REAL member:
 *
 * - GAJIAN (payday — spec's fictional `DP_RINGAN, CICILAN_RINGAN, KREDIT_MUDAH` intent):
 *   AUTOMOTIVE → real `DP_RINGAN` (down-payment framing, direct spec match) + `KREDIT_SYARIAH`
 *   (closest real "easy financing" angle to the fictional `KREDIT_MUDAH`). PROPERTY → real
 *   `DP_RINGAN` (also a real `PropertyAdAngle` member) + `PROMO_TERBATAS`.
 * - HARBOLNAS (shopping-holiday urgency — spec's fictional `PROMO_TERBATAS, STOK_TERBATAS,
 *   YEAR_END_SPECIAL`): AUTOMOTIVE → real `DP_RINGAN` (act-now purchase incentive) + `GUDANGNYA`.
 *   `GUDANGNYA`'s real copy (`BusinessKnowledgeBase.ANGLE_USP_MAP`: "Stok puluhan unit ready,
 *   pilih langsung di showroom") is actually an ABUNDANCE framing, not the spec's SCARCITY
 *   framing — chosen anyway because it is the only real `AdAngle` whose topic is unit
 *   stock/availability at all; no real member captures "hurry, limited quantity" tone. PROPERTY →
 *   real `PROMO_TERBATAS` (literal real match) + `READY_HUNI` (move-in-now urgency analog).
 * - YEAREND (year-end bonus — spec's fictional `INVESTASI, UPGRADE_UNIT, YEAR_END_SPECIAL`):
 *   AUTOMOTIVE → real `DISCOVERY` (browse-the-full-range, closest to "upgrade unit" intent) +
 *   `TESTIMONIAL` (trust-building for a bigger year-end purchase decision). PROPERTY → real
 *   `INVESTASI` (literal real match) + `EXCLUSIVE` (premium/upgrade analog).
 * - WEEKEND (in-person weekend visit — spec's fictional `TEST_DRIVE, SURVEY_LANGSUNG`):
 *   AUTOMOTIVE → real `QNA` (closest to "survey langsung"/ask-in-person intent) + `DISCOVERY`
 *   (closest to "test drive"/come-explore-in-person intent). PROPERTY → real `VIRTUAL_TOUR`
 *   (closest to an in-person/virtual site-visit intent) + `TESTIMONIAL`.
 *
 * `THR`/`LEBARAN` (spec's `startDate`/`endDate: '??-??'`) is DELIBERATELY OMITTED. Idul Fitri's
 * Gregorian date is set annually by the Indonesian government's sidang isbat (Hijri
 * moon-sighting), typically confirmed only 1-2 days beforehand — a real per-year lookup table
 * would need to be fabricated for any year beyond the very near term. A web check for the next
 * two years' widely-published ESTIMATES already shows disagreement between reputable Indonesian
 * calendar sources (2027: some cite 9 March, others 10 March), before the government's own
 * official confirmation even exists — hardcoding an approximate date for a religious holiday
 * this session's own discipline explicitly warns against. A real implementation needs either a
 * maintained Hijri-calendar data source or a manually-curated, periodically-updated per-year
 * table sourced from the Kemenag's actual sidang isbat announcements — out of scope for this
 * pure/deterministic Phase 1 pass.
 */
const SEASONAL_EVENTS: ReadonlyArray<SeasonalEvent> = [
  {
    name: "Gajian Akhir Bulan",
    type: "GAJIAN",
    budgetMultiplier: 1.4,
    priority: "HIGH",
    recommendedAngles: {
      AUTOMOTIVE: [AdAngle.DP_RINGAN, AdAngle.KREDIT_SYARIAH],
      PROPERTY: ["DP_RINGAN", "PROMO_TERBATAS"],
    },
    isActive: isGajianActive,
    daysUntilNextStart: daysUntilNextGajianStart,
  },
  {
    name: "Harbolnas 11.11",
    type: "HARBOLNAS",
    budgetMultiplier: 1.5,
    priority: "HIGH",
    recommendedAngles: {
      AUTOMOTIVE: [AdAngle.DP_RINGAN, AdAngle.GUDANGNYA],
      PROPERTY: ["PROMO_TERBATAS", "READY_HUNI"],
    },
    isActive: (date) => inAnnualRange(date, 11, 9, 11, 12),
    daysUntilNextStart: (date) => daysUntilNextAnnual(date, 11, 9, 11, 12),
  },
  {
    name: "Harbolnas 12.12",
    type: "HARBOLNAS",
    budgetMultiplier: 1.5,
    priority: "HIGH",
    recommendedAngles: {
      AUTOMOTIVE: [AdAngle.DP_RINGAN, AdAngle.GUDANGNYA],
      PROPERTY: ["PROMO_TERBATAS", "READY_HUNI"],
    },
    isActive: (date) => inAnnualRange(date, 12, 10, 12, 13),
    daysUntilNextStart: (date) => daysUntilNextAnnual(date, 12, 10, 12, 13),
  },
  {
    name: "Bonus Akhir Tahun",
    type: "YEAREND",
    budgetMultiplier: 1.3,
    priority: "MEDIUM",
    recommendedAngles: {
      AUTOMOTIVE: [AdAngle.DISCOVERY, AdAngle.TESTIMONIAL],
      PROPERTY: ["INVESTASI", "EXCLUSIVE"],
    },
    isActive: (date) => inAnnualRange(date, 12, 20, 12, 31),
    daysUntilNextStart: (date) => daysUntilNextAnnual(date, 12, 20, 12, 31),
  },
  {
    name: "Weekend",
    type: "WEEKEND",
    budgetMultiplier: 1.15,
    priority: "LOW",
    recommendedAngles: {
      AUTOMOTIVE: [AdAngle.QNA, AdAngle.DISCOVERY],
      PROPERTY: ["VIRTUAL_TOUR", "TESTIMONIAL"],
    },
    isActive: isWeekendActive,
    daysUntilNextStart: daysUntilNextWeekendStart,
  },
];

/** Zero-external-dependency seasonal-calendar signal source — see file docstring. */
export class SeasonalCalendarService {
  constructor(private readonly now: () => Date = () => new Date()) {}

  /** Every event whose window covers `referenceDate` (defaults to `this.now()`). */
  getCurrentEvents(referenceDate: Date = this.now()): ReadonlyArray<SeasonalEvent> {
    return SEASONAL_EVENTS.filter((event) => event.isActive(referenceDate));
  }

  /** Events NOT currently active whose next occurrence starts within `withinDays` days of `referenceDate`. */
  getUpcomingEvents(
    withinDays = 7,
    referenceDate: Date = this.now(),
  ): ReadonlyArray<SeasonalEvent> {
    return SEASONAL_EVENTS.filter((event) => {
      if (event.isActive(referenceDate)) {
        return false;
      }
      const days = event.daysUntilNextStart(referenceDate);
      return days > 0 && days <= withinDays;
    });
  }

  /**
   * The spec's `getRecommendation`: active events win (highest `budgetMultiplier` first), else
   * the nearest upcoming event within 7 days, else a normal-period signal. `vertical` selects
   * which half of `recommendedAngles` is surfaced.
   */
  getRecommendation(
    vertical: IntelVertical,
    referenceDate: Date = this.now(),
  ): SeasonalRecommendation {
    const active = this.getCurrentEvents(referenceDate);
    if (active.length > 0) {
      const top = [...active].sort((a, b) => b.budgetMultiplier - a.budgetMultiplier)[0];
      /* v8 ignore next 4 -- unreachable: active.length > 0 guarantees a first element after sort. */
      if (top === undefined) {
        return { isSpecialPeriod: false, reasoning: "Periode normal" };
      }
      return {
        isSpecialPeriod: true,
        eventName: top.name,
        budgetMultiplier: top.budgetMultiplier,
        recommendedAngles: top.recommendedAngles[vertical],
        reasoning: `${top.name} aktif — scale budget ${String(Math.round((top.budgetMultiplier - 1) * 100))}%`,
      };
    }

    const upcoming = [...this.getUpcomingEvents(7, referenceDate)].sort(
      (a, b) => a.daysUntilNextStart(referenceDate) - b.daysUntilNextStart(referenceDate),
    );
    // Unreachable in practice: WEEKEND recurs at most every 5 days (Monday's
    // `daysUntilNextStart`), so `getUpcomingEvents(7, ...)` is never empty when no event is
    // currently active — this fallback only guards a hypothetical future `SEASONAL_EVENTS` edit
    // that removes WEEKEND or shortens the lookahead window below 5 days.
    const next = upcoming[0];
    /* v8 ignore next 3 */
    if (next === undefined) {
      return { isSpecialPeriod: false, reasoning: "Periode normal" };
    }

    const days = next.daysUntilNextStart(referenceDate);
    return {
      isSpecialPeriod: false,
      upcomingEvent: next.name,
      daysUntil: days,
      recommendedAngles: next.recommendedAngles[vertical],
      reasoning: `${next.name} dalam ${String(days)} hari — siapkan konten teaser`,
    };
  }
}
