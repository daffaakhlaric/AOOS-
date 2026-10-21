/**
 * Creative Stress Test — "Simulation Runs" history table mappers. Pure functions, no JSX, no I/O.
 *
 * Every value is read from a real persisted `StressTestRunDto` (the list endpoint returns the full
 * run including `result` and `failedReason`) or from real context the page fetched (listing detail,
 * persona presets). Anything without a real source is `undefined` and rendered as "—". In
 * particular:
 * - Readiness comes ONLY from the backend's real `result.scoreBucket` — it is never inferred from
 *   `status === "COMPLETED"`.
 * - Score is `undefined` (never 0) when the result has no `overallScore`.
 * - Per-evaluator progress is shown only when the backend persisted it (`lib/stress-test-progress.ts`).
 * - Objection resolution counts come only from the real Objection Resolution evaluator; runs without
 *   it keep the plain total/unique count.
 * - Campaign titles come from the real `/api/campaigns` list (fetched once by the page); a campaign
 *   id that is not in that list renders "—".
 * - There is no Kai-draft / experiment status on a run, so none is exposed here.
 */
import {
  MODE_LABELS,
  SCORE_BUCKET_LABELS,
  STATUS_LABELS,
  type PersonaPresetId,
  type StressTestMode,
  type StressTestRunDto,
  type StressTestScoreBucket,
  type StressTestSourceType,
  type StressTestStatus,
} from "@/lib/stress-test";
import {
  isInProgressStatus,
  partialResultOf,
  progressOf,
  summarizeProgress,
  type ProgressSummary,
} from "@/lib/stress-test-progress";
import {
  SCORE_BUCKET_TONE,
  aggregateObjections,
  buildPriorityList,
  evaluatedResultOf,
  type ListingContext,
  type Tone,
} from "@/lib/stress-test-result";

/* ------------------------------------------------------------------------------------------------
 * Small presentation helpers
 * --------------------------------------------------------------------------------------------- */

export const SOURCE_TYPE_LABELS: Record<StressTestSourceType, string> = {
  LISTING: "Listing",
  CAMPAIGN: "Campaign",
  CAMPAIGN_DRAFT: "Draft Campaign",
  CREATIVE_PACKAGE: "Creative Package",
};

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

/**
 * Confidence level thresholds (presentation only). The backend's `confidence` is 0–100 = share of
 * attempted evaluators that succeeded, minus a penalty when the Fact Validator could not run (see
 * aaos-api `computeStressTestScoring`). It measures how complete the evaluation was — NOT the
 * probability that the campaign succeeds.
 * - High:   confidence >= 80
 * - Medium: 50 <= confidence < 80
 * - Low:    confidence < 50
 */
export const CONFIDENCE_THRESHOLDS = { HIGH: 80, MEDIUM: 50 } as const;

export const CONFIDENCE_LEVEL_LABELS: Record<ConfidenceLevel, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const CONFIDENCE_TOOLTIP =
  "Kelengkapan evaluasi (evaluator yang berhasil dijalankan) — bukan probabilitas keberhasilan campaign.";

export function confidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return "HIGH";
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return "MEDIUM";
  return "LOW";
}

/** Up to 2 initials from a label ("Price Sensitive" -> "PS", "Investor" -> "IN"). */
export function initialsOf(label: string): string {
  const words = label
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return "?";
  if (words.length === 1) return (words[0] ?? "").slice(0, 2).toUpperCase();
  return `${(words[0] ?? "").charAt(0)}${(words[1] ?? "").charAt(0)}`.toUpperCase();
}

export function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8);
}

const MONTHS_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/** "28 Sep 2026 · 15:07" in the viewer's local time zone. */
export function formatRunCreatedAt(iso: string): string | undefined {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return undefined;
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${String(d.getDate())} ${MONTHS_ID[d.getMonth()] ?? ""} ${String(d.getFullYear())} · ${hh}:${mm}`;
}

/** "baru saja" / "5 mnt lalu" / "3 jam lalu" / "2 hari lalu" / "4 bln lalu" / "1 thn lalu". */
export function formatRelativeTime(iso: string, nowMs: number): string | undefined {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return undefined;
  const diffSec = Math.max(0, Math.round((nowMs - ms) / 1000));
  if (diffSec < 60) return "baru saja";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${String(min)} mnt lalu`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${String(hours)} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${String(days)} hari lalu`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${String(months)} bln lalu`;
  return `${String(Math.floor(days / 365))} thn lalu`;
}

/* ------------------------------------------------------------------------------------------------
 * Row mapper
 * --------------------------------------------------------------------------------------------- */

export interface PersonaChip {
  readonly id: string;
  readonly label: string;
  readonly initials: string;
}

export type CreativeCell =
  /** The run selected no specific creative. */
  | { readonly kind: "NONE" }
  /** ≥1 creative id resolved against real listing photos. */
  | {
      readonly kind: "RESOLVED";
      readonly resolved: number;
      readonly selected: number;
      readonly thumbnailUrl?: string;
    }
  /** Creative ids exist but cannot be resolved from context already loaded — rendered "—". */
  | { readonly kind: "UNRESOLVED"; readonly selected: number };

export interface SimulationRunListItem {
  readonly id: string;
  readonly shortId: string;
  readonly name: string;
  readonly href: string;
  readonly objectionsHref: string;
  readonly sourceType: StressTestSourceType;
  readonly sourceTypeLabel: string;
  /** Real listing title, or real campaign name from the campaigns list; undefined when neither resolved. */
  readonly contextTitle?: string;
  readonly contextThumbnailUrl?: string;
  readonly contextLoading: boolean;
  readonly creative: CreativeCell;
  readonly mode: StressTestMode;
  readonly modeLabel: string;
  readonly personas: readonly PersonaChip[];
  readonly status: StressTestStatus;
  readonly statusLabel: string;
  readonly inProgress: boolean;
  /** Real persisted per-evaluator progress (QUEUED/RUNNING only); undefined -> "Sedang dievaluasi". */
  readonly progress?: ProgressSummary;
  readonly failed: boolean;
  /** FAILED run with a real partial result to show ("Lihat Hasil Parsial"). */
  readonly hasPartialResult: boolean;
  /** Real `failedReason`; undefined -> "Alasan tidak tercatat". Only set for FAILED runs. */
  readonly failureReason?: string;
  readonly hasEvaluatedResult: boolean;
  readonly bucket?: StressTestScoreBucket;
  readonly bucketLabel?: string;
  readonly bucketTone?: Tone;
  readonly score?: number;
  readonly confidence?: number;
  readonly confidenceLevel?: ConfidenceLevel;
  readonly topIssue?: string;
  readonly objections?: {
    readonly total: number;
    readonly unique: number;
    /** Only when the Objection Resolution evaluator assessed this run. */
    readonly resolution?: { readonly unresolved: number; readonly partial: number };
  };
  readonly createdAtMs: number;
  readonly createdLabel?: string;
  readonly relativeLabel?: string;
  /** Lowercased name + context title, for the search box. */
  readonly searchText: string;
}

export interface RunListContext {
  /** listingId -> real parsed listing (null = fetch finished but nothing usable). Missing key = still loading. */
  readonly listings: ReadonlyMap<string, ListingContext | null>;
  /** Real persona preset labels from `/api/creative-stress-test/persona-presets`. */
  readonly personaLabels: ReadonlyMap<string, string>;
  /** campaignId -> real campaign name from `/api/campaigns`. Absent = not fetched. */
  readonly campaignNames?: ReadonlyMap<string, string>;
  /** True while the campaigns list is still loading. */
  readonly campaignsLoading?: boolean;
  readonly nowMs: number;
}

function personaChips(
  run: StressTestRunDto,
  personaLabels: ReadonlyMap<string, string>,
): readonly PersonaChip[] {
  const fromResult = new Map<string, string>();
  const evaluated = evaluatedResultOf(run);
  for (const attempt of evaluated?.personaCritiques ?? [])
    fromResult.set(attempt.personaId, attempt.personaLabel);
  return run.personaIds.map((id: PersonaPresetId) => {
    // Real label from the run's own result, else from the real preset config, else the raw id.
    const label = fromResult.get(id) ?? personaLabels.get(id) ?? id;
    return { id, label, initials: initialsOf(label) };
  });
}

function creativeCell(
  run: StressTestRunDto,
  listing: ListingContext | null | undefined,
): CreativeCell {
  if (run.creativeIds.length === 0) return { kind: "NONE" };
  if (run.sourceType !== "LISTING" || listing === null || listing === undefined) {
    return { kind: "UNRESOLVED", selected: run.creativeIds.length };
  }
  const photos = run.creativeIds.flatMap((id) => listing.photos.filter((p) => p.id === id));
  if (photos.length === 0) return { kind: "UNRESOLVED", selected: run.creativeIds.length };
  return {
    kind: "RESOLVED",
    resolved: photos.length,
    selected: run.creativeIds.length,
    ...(photos[0] !== undefined ? { thumbnailUrl: photos[0].url } : {}),
  };
}

export function mapSimulationRunListItem(
  run: StressTestRunDto,
  ctx: RunListContext,
): SimulationRunListItem {
  const listing = run.listingId !== undefined ? ctx.listings.get(run.listingId) : undefined;
  const campaignName =
    run.campaignId !== undefined ? ctx.campaignNames?.get(run.campaignId) : undefined;
  const contextLoading =
    (run.listingId !== undefined && !ctx.listings.has(run.listingId)) ||
    (run.listingId === undefined && run.campaignId !== undefined && ctx.campaignsLoading === true);
  const evaluated = evaluatedResultOf(run);
  const failed = run.status === "FAILED";
  // Same rule as the detail page: a FAILED run never exposes a result.
  const result = failed ? undefined : evaluated;

  let topIssue: string | undefined;
  let objections: SimulationRunListItem["objections"];
  if (result !== undefined) {
    const rec = result.primaryRecommendation.trim();
    topIssue = rec.length > 0 ? rec : buildPriorityList(result)[0]?.title;
    const agg = aggregateObjections(result);
    const assessed =
      result.objectionResolution?.status === "ASSESSED"
        ? result.objectionResolution.items
        : undefined;
    objections = {
      total: agg.totalObjections,
      unique: agg.uniqueObjections,
      ...(assessed !== undefined
        ? {
            resolution: {
              unresolved: assessed.filter((i) => i.resolutionStatus === "UNRESOLVED").length,
              partial: assessed.filter((i) => i.resolutionStatus === "PARTIAL").length,
            },
          }
        : {}),
    };
  }

  const bucket = result?.scoreBucket ?? undefined;
  const score = result?.overallScore ?? undefined;
  const confidence =
    result !== undefined && Number.isFinite(result.confidence) ? result.confidence : undefined;
  const contextThumbnailUrl =
    listing !== null && listing !== undefined
      ? (listing.mainPhotoUrl ?? listing.photos[0]?.url)
      : undefined;
  const contextTitle = listing !== null && listing !== undefined ? listing.title : campaignName;
  const inProgress = isInProgressStatus(run.status);
  const persistedProgress = inProgress ? progressOf(run) : undefined;
  const progress =
    persistedProgress !== undefined ? summarizeProgress(persistedProgress) : undefined;
  const createdAtMs = Date.parse(run.createdAt);
  const createdLabel = formatRunCreatedAt(run.createdAt);
  const relativeLabel = formatRelativeTime(run.createdAt, ctx.nowMs);
  const failureReason =
    failed && run.failedReason !== undefined && run.failedReason.trim().length > 0
      ? run.failedReason
      : undefined;

  return {
    id: run.id,
    shortId: shortId(run.id),
    name: run.name,
    href: `/samantha/stress-test/${run.id}`,
    objectionsHref: `/samantha/stress-test/${run.id}#objections`,
    sourceType: run.sourceType,
    sourceTypeLabel: SOURCE_TYPE_LABELS[run.sourceType] ?? run.sourceType,
    ...(contextTitle !== undefined ? { contextTitle } : {}),
    ...(contextThumbnailUrl !== undefined ? { contextThumbnailUrl } : {}),
    contextLoading,
    creative: creativeCell(run, listing),
    mode: run.mode,
    modeLabel: MODE_LABELS[run.mode] ?? run.mode,
    personas: personaChips(run, ctx.personaLabels),
    status: run.status,
    statusLabel: STATUS_LABELS[run.status] ?? run.status,
    inProgress,
    ...(progress !== undefined ? { progress } : {}),
    failed,
    hasPartialResult: partialResultOf(run) !== undefined,
    ...(failureReason !== undefined ? { failureReason } : {}),
    hasEvaluatedResult: result !== undefined,
    ...(bucket !== undefined
      ? { bucket, bucketLabel: SCORE_BUCKET_LABELS[bucket], bucketTone: SCORE_BUCKET_TONE[bucket] }
      : {}),
    ...(score !== undefined ? { score } : {}),
    ...(confidence !== undefined
      ? { confidence, confidenceLevel: confidenceLevel(confidence) }
      : {}),
    ...(topIssue !== undefined ? { topIssue } : {}),
    ...(objections !== undefined ? { objections } : {}),
    createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : 0,
    ...(createdLabel !== undefined ? { createdLabel } : {}),
    ...(relativeLabel !== undefined ? { relativeLabel } : {}),
    searchText: `${run.name} ${contextTitle ?? ""}`.toLowerCase(),
  };
}

/* ------------------------------------------------------------------------------------------------
 * Filter / sort / paginate
 * --------------------------------------------------------------------------------------------- */

export type HistorySort = "NEWEST" | "OLDEST" | "SCORE_DESC" | "SCORE_ASC";
/** Quick chips — only real, persisted fields. "Perlu Revisi" = real bucket NEEDS_REVISION or MAJOR_ISSUES. */
export type HistoryChip = "ALL" | "NEEDS_REVISION" | "READY_TO_TEST" | "DEEP";
export type ReadinessFilter = "ALL" | StressTestScoreBucket | "NONE";
export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export interface SimulationHistoryFilters {
  readonly search: string;
  readonly status: "ALL" | StressTestStatus;
  readonly mode: "ALL" | StressTestMode;
  readonly readiness: ReadinessFilter;
  readonly contextType: "ALL" | StressTestSourceType;
  readonly sort: HistorySort;
  /** "YYYY-MM-DD" (local) or "". Inclusive. */
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly chip: HistoryChip;
  readonly page: number;
  readonly pageSize: PageSize;
}

export const DEFAULT_HISTORY_FILTERS: SimulationHistoryFilters = {
  search: "",
  status: "ALL",
  mode: "ALL",
  readiness: "ALL",
  contextType: "ALL",
  sort: "NEWEST",
  dateFrom: "",
  dateTo: "",
  chip: "ALL",
  page: 1,
  pageSize: 25,
};

export const HISTORY_CHIPS: readonly {
  readonly id: HistoryChip;
  readonly label: string;
  readonly title?: string;
}[] = [
  { id: "ALL", label: "Semua" },
  {
    id: "NEEDS_REVISION",
    label: "Perlu Revisi",
    title: "Readiness Perlu Revisi atau Masalah Besar",
  },
  { id: "READY_TO_TEST", label: "Siap Diuji" },
  { id: "DEEP", label: "Deep" },
];

function localDayStart(ymd: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (m === null) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

function matchesChip(item: SimulationRunListItem, chip: HistoryChip): boolean {
  switch (chip) {
    case "ALL":
      return true;
    case "NEEDS_REVISION":
      return item.bucket === "NEEDS_REVISION" || item.bucket === "MAJOR_ISSUES";
    case "READY_TO_TEST":
      return item.bucket === "READY_TO_TEST";
    case "DEEP":
      return item.mode === "DEEP";
  }
}

export interface SimulationHistoryPage {
  readonly rows: readonly SimulationRunListItem[];
  /** All items before filtering. */
  readonly total: number;
  /** Items after filtering, before paging. */
  readonly filteredCount: number;
  readonly page: number;
  readonly pageCount: number;
  readonly pageSize: PageSize;
}

/** Filters, sorts (runs without a score always sort last for score sorts) and paginates (page is clamped). */
export function mapSimulationHistory(
  items: readonly SimulationRunListItem[],
  filters: SimulationHistoryFilters,
): SimulationHistoryPage {
  const q = filters.search.trim().toLowerCase();
  const from = localDayStart(filters.dateFrom);
  const toStart = localDayStart(filters.dateTo);
  const to = toStart !== undefined ? toStart + 24 * 60 * 60 * 1000 : undefined;

  const filtered = items.filter(
    (item) =>
      (q.length === 0 || item.searchText.includes(q)) &&
      (filters.status === "ALL" || item.status === filters.status) &&
      (filters.mode === "ALL" || item.mode === filters.mode) &&
      (filters.readiness === "ALL" ||
        (filters.readiness === "NONE"
          ? item.bucket === undefined
          : item.bucket === filters.readiness)) &&
      (filters.contextType === "ALL" || item.sourceType === filters.contextType) &&
      (from === undefined || item.createdAtMs >= from) &&
      (to === undefined || item.createdAtMs < to) &&
      matchesChip(item, filters.chip),
  );

  const sorted = filtered
    .map((item, order) => ({ item, order }))
    .sort((a, b) => {
      switch (filters.sort) {
        case "OLDEST":
          return a.item.createdAtMs - b.item.createdAtMs || a.order - b.order;
        case "SCORE_DESC":
        case "SCORE_ASC": {
          const sa = a.item.score;
          const sb = b.item.score;
          if (sa === undefined && sb === undefined)
            return b.item.createdAtMs - a.item.createdAtMs || a.order - b.order;
          if (sa === undefined) return 1;
          if (sb === undefined) return -1;
          return (
            (filters.sort === "SCORE_DESC" ? sb - sa : sa - sb) ||
            b.item.createdAtMs - a.item.createdAtMs
          );
        }
        case "NEWEST":
        default:
          return b.item.createdAtMs - a.item.createdAtMs || a.order - b.order;
      }
    })
    .map((x) => x.item);

  const pageSize = filters.pageSize;
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(Math.max(1, Math.floor(filters.page)), pageCount);
  return {
    rows: sorted.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    filteredCount: sorted.length,
    page,
    pageCount,
    pageSize,
  };
}
