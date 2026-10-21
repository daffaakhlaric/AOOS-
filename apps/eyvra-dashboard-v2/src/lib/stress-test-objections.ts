/**
 * Creative Stress Test — "Objection Intelligence" table mappers. Pure functions, no JSX, no I/O.
 *
 * Source data: ONLY the real, LLM-simulated persona critiques on a persisted evaluated result
 * (`personaCritiques[].critique.objections[] = { objection, severity }`). Rows are grouped by exact
 * normalized text (`normalizeObjectionText`), never merged by category.
 *
 * Resolution status / goal impact / short recommendation / evidence come ONLY from the backend
 * Objection Resolution evaluator (`result.objectionResolution`, an AI assessment verified
 * server-side). Items are joined onto rows by `key` = `normalizeObjectionText` (the backend uses a
 * byte-identical copy of that normalizer). Rows with no matching item — every row of a run created
 * before the evaluator existed, a SKIPPED/FAILED evaluator, or an objection the LLM skipped — stay
 * `"NOT_ASSESSED"` ("Belum dinilai") with impact/recommendation `undefined` ("—"). Never derived
 * from severity.
 *
 * Other honest gaps:
 * - Category: no category field. `classifyObjection` is a deterministic keyword classifier, always
 *   labelled "Kategori otomatis (berdasarkan kata kunci)".
 * - Live buyer frequency: First Message / Respon Pintar are not connected -> never computed.
 */
import {
  OBJECTION_SEVERITY_LABELS,
  PRIMARY_GOAL_LABELS,
  type StressTestClaimFindingDto,
  type StressTestEvaluatedResultDto,
  type StressTestGoalImpact,
  type StressTestObjectionResolutionItemDto,
  type StressTestObjectionSeverity,
  type StressTestPrimaryGoal,
} from "@/lib/stress-test";
import {
  SEVERITY_RANK,
  SEVERITY_TONE,
  normalizeObjectionText,
  succeededPersonas,
  type Tone,
} from "@/lib/stress-test-result";
import { initialsOf } from "@/lib/stress-test-history";

/* ------------------------------------------------------------------------------------------------
 * Keyword classifier
 * --------------------------------------------------------------------------------------------- */

export type ObjectionCategory =
  | "PRICE_VALUE"
  | "LEGAL_SECURITY"
  | "FINANCING"
  | "LOCATION_FACILITIES"
  | "SURVEY_VISIT"
  | "TIMING_PROMO"
  | "PRODUCT_QUALITY"
  | "TRUST_COMPARISON"
  | "OTHER";

export const OBJECTION_CATEGORY_LABELS: Record<ObjectionCategory, string> = {
  PRICE_VALUE: "Harga / Nilai",
  LEGAL_SECURITY: "Legal / Keamanan",
  FINANCING: "Pembiayaan",
  LOCATION_FACILITIES: "Lokasi / Fasilitas",
  SURVEY_VISIT: "Survey / Kunjungan",
  TIMING_PROMO: "Waktu / Promo",
  PRODUCT_QUALITY: "Kualitas Produk",
  TRUST_COMPARISON: "Kepercayaan / Perbandingan",
  OTHER: "Lainnya",
};

export const AUTO_CATEGORY_NOTE = "Kategori otomatis (berdasarkan kata kunci)";

/**
 * Ordered keyword rules — the FIRST category with a matching keyword wins. A keyword matches when it
 * appears at the START of a word (so "mahal" matches "mahalnya", "legal" matches "legalitas", "dp"
 * matches "DP" but not "adp"). Matching is case-insensitive on the raw objection text.
 */
export const OBJECTION_CATEGORY_RULES: readonly {
  readonly category: Exclude<ObjectionCategory, "OTHER">;
  readonly keywords: readonly string[];
}[] = [
  {
    category: "PRICE_VALUE",
    keywords: [
      "harga",
      "mahal",
      "budget",
      "bujet",
      "anggaran",
      "nilai",
      "value",
      "worth",
      "biaya",
      "price",
    ],
  },
  {
    category: "LEGAL_SECURITY",
    keywords: [
      "shm",
      "hgb",
      "ajb",
      "sertifikat",
      "legal",
      "imb",
      "pbg",
      "izin",
      "keamanan",
      "aman",
      "sengketa",
    ],
  },
  {
    category: "FINANCING",
    keywords: [
      "kpr",
      "cicil",
      "dp",
      "uang muka",
      "bank",
      "bunga",
      "tenor",
      "angsur",
      "pembiayaan",
      "kredit",
    ],
  },
  {
    category: "LOCATION_FACILITIES",
    keywords: [
      "lokasi",
      "akses",
      "jalan",
      "sekolah",
      "fasilitas",
      "banjir",
      "macet",
      "jarak",
      "transportasi",
      "lingkungan",
    ],
  },
  {
    category: "SURVEY_VISIT",
    keywords: ["survey", "survei", "lihat langsung", "kunjung", "tinjau", "site visit"],
  },
  {
    category: "TIMING_PROMO",
    keywords: ["promo", "diskon", "nanti", "tunggu", "menunggu", "waktu", "timing"],
  },
  {
    category: "PRODUCT_QUALITY",
    keywords: [
      "kualitas",
      "spesifikasi",
      "spek",
      "bangunan",
      "material",
      "konstruksi",
      "finishing",
    ],
  },
  {
    category: "TRUST_COMPARISON",
    keywords: [
      "bandingkan",
      "dibanding",
      "perbandingan",
      "pembanding",
      "pilihan lain",
      "opsi lain",
      "developer",
      "percaya",
      "kepercayaan",
      "reputasi",
      "track record",
    ],
  },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const COMPILED_RULES = OBJECTION_CATEGORY_RULES.map((rule) => ({
  category: rule.category,
  patterns: rule.keywords.map((k) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(k)}`, "i")),
}));

export function classifyObjection(text: string): ObjectionCategory {
  const lower = text.toLowerCase();
  for (const rule of COMPILED_RULES) {
    if (rule.patterns.some((p) => p.test(lower))) return rule.category;
  }
  return "OTHER";
}

export const OBJECTION_CATEGORY_TONE: Record<ObjectionCategory, string> = {
  PRICE_VALUE: "red",
  LEGAL_SECURITY: "purple",
  FINANCING: "blue",
  LOCATION_FACILITIES: "green",
  SURVEY_VISIT: "teal",
  TIMING_PROMO: "amber",
  PRODUCT_QUALITY: "indigo",
  TRUST_COMPARISON: "pink",
  OTHER: "gray",
};

/* ------------------------------------------------------------------------------------------------
 * Rows
 * --------------------------------------------------------------------------------------------- */

export type ResolutionStatus =
  | "RESOLVED"
  | "PARTIAL"
  | "UNRESOLVED"
  | "REQUIRES_KNOWLEDGE"
  | "REQUIRES_SALES"
  | "NOT_SOLVABLE_IN_CREATIVE"
  | "NOT_ASSESSED";

export const RESOLUTION_LABELS: Record<ResolutionStatus, string> = {
  UNRESOLVED: "Belum Terjawab",
  PARTIAL: "Sebagian Terjawab",
  RESOLVED: "Sudah Terjawab",
  REQUIRES_KNOWLEDGE: "Butuh Knowledge",
  REQUIRES_SALES: "Butuh Sales Follow-up",
  NOT_SOLVABLE_IN_CREATIVE: "Bukan Masalah Creative",
  NOT_ASSESSED: "Belum dinilai",
};

export const RESOLUTION_TONE: Record<ResolutionStatus, Tone> = {
  UNRESOLVED: "critical",
  PARTIAL: "warning",
  RESOLVED: "success",
  REQUIRES_KNOWLEDGE: "info",
  REQUIRES_SALES: "info",
  NOT_SOLVABLE_IN_CREATIVE: "neutral",
  NOT_ASSESSED: "neutral",
};

export const GOAL_IMPACT_LABELS: Record<StressTestGoalImpact, string> = {
  VERY_HIGH: "Sangat Tinggi",
  HIGH: "Tinggi",
  MEDIUM: "Sedang",
  LOW: "Rendah",
};

export const GOAL_IMPACT_TONE: Record<StressTestGoalImpact, Tone> = {
  VERY_HIGH: "critical",
  HIGH: "warning",
  MEDIUM: "info",
  LOW: "neutral",
};

const IMPACT_RANK: Record<StressTestGoalImpact, number> = {
  VERY_HIGH: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/** "Open" = still needs work in or around the creative; sorts before closed/unassessed rows. */
const OPEN_RESOLUTIONS: ReadonlySet<ResolutionStatus> = new Set<ResolutionStatus>([
  "UNRESOLVED",
  "PARTIAL",
  "REQUIRES_KNOWLEDGE",
  "REQUIRES_SALES",
]);

export const AI_ESTIMATE_LABEL = "Estimasi AI (simulasi)";

export type FrequencyTone = "critical" | "warning" | "info";

/** Frequency bar colour: red >= 80%, amber >= 50%, blue below. */
export function frequencyTone(pct: number): FrequencyTone {
  if (pct >= 80) return "critical";
  if (pct >= 50) return "warning";
  return "info";
}

export interface ObjectionPersona {
  readonly personaId: string;
  readonly label: string;
  readonly initials: string;
  readonly severity: StressTestObjectionSeverity;
  /** This persona's own original objection text. */
  readonly text: string;
}

export interface ObjectionRow {
  readonly key: string;
  readonly rank: number;
  readonly objection: string;
  readonly category: ObjectionCategory;
  readonly categoryLabel: string;
  readonly severity: StressTestObjectionSeverity;
  readonly severityLabel: string;
  readonly severityTone: Tone;
  readonly personas: readonly ObjectionPersona[];
  readonly personaCount: number;
  /** Denominator = personas whose simulation succeeded on this run. */
  readonly personasSimulated: number;
  /** Rounded % of simulated personas raising it. Simulation agreement, NOT buyer frequency. */
  readonly agreementPct: number;
  readonly frequencyTone: FrequencyTone;
  /** AI-estimated impact on the primary goal (Objection Resolution evaluator); undefined = not assessed. */
  readonly impact?: StressTestGoalImpact;
  readonly impactLabel?: string;
  readonly resolution: ResolutionStatus;
  readonly resolutionLabel: string;
  /** AI short recommendation; undefined = not assessed. */
  readonly recommendation?: string;
  /** Verbatim creative quote (verified server-side) that addresses the objection. */
  readonly evidence?: string;
  /** Set when the backend overrode the raw AI assessment (see aaos-api `objection-resolution.ts`). */
  readonly adjustment?: StressTestObjectionResolutionItemDto["adjustment"];
  readonly source: "SIMULATED";
  /** First-seen order across personas (stable tiebreak). */
  readonly order: number;
}

interface ObjectionGroup {
  readonly key: string;
  readonly objection: string;
  readonly order: number;
  readonly personas: readonly ObjectionPersona[];
}

/** One aggregated group -> table row. `assessment` is the matching real evaluator item, if any. */
export function mapObjectionRow(
  group: ObjectionGroup,
  personasSimulated: number,
  rank: number,
  assessment?: StressTestObjectionResolutionItemDto,
): ObjectionRow {
  const severity = group.personas.reduce<StressTestObjectionSeverity>(
    (max, p) => (SEVERITY_RANK[p.severity] > SEVERITY_RANK[max] ? p.severity : max),
    "LOW",
  );
  const agreementPct =
    personasSimulated === 0 ? 0 : Math.round((100 * group.personas.length) / personasSimulated);
  const category = classifyObjection(group.objection);
  return {
    key: group.key,
    rank,
    objection: group.objection,
    category,
    categoryLabel: OBJECTION_CATEGORY_LABELS[category],
    severity,
    severityLabel: OBJECTION_SEVERITY_LABELS[severity],
    severityTone: SEVERITY_TONE[severity],
    personas: group.personas,
    personaCount: group.personas.length,
    personasSimulated,
    agreementPct,
    frequencyTone: frequencyTone(agreementPct),
    resolution: assessment?.resolutionStatus ?? "NOT_ASSESSED",
    resolutionLabel: RESOLUTION_LABELS[assessment?.resolutionStatus ?? "NOT_ASSESSED"],
    ...(assessment !== undefined
      ? {
          impact: assessment.goalImpact,
          impactLabel: GOAL_IMPACT_LABELS[assessment.goalImpact],
          recommendation: assessment.shortRecommendation,
          ...(assessment.evidence !== null ? { evidence: assessment.evidence } : {}),
          ...(assessment.adjustment !== undefined ? { adjustment: assessment.adjustment } : {}),
        }
      : {}),
    source: "SIMULATED",
    order: group.order,
  };
}

export interface ObjectionRowsResult {
  readonly rows: readonly ObjectionRow[];
  readonly totalObjections: number;
  readonly personasSimulated: number;
}

/** Real evaluator items keyed by normalized text — empty unless the evaluator actually ASSESSED this run. */
export function resolutionItemsByKey(
  result: Pick<StressTestEvaluatedResultDto, "objectionResolution">,
): ReadonlyMap<string, StressTestObjectionResolutionItemDto> {
  const map = new Map<string, StressTestObjectionResolutionItemDto>();
  if (result.objectionResolution?.status !== "ASSESSED") return map;
  for (const item of result.objectionResolution.items) {
    const key = normalizeObjectionText(item.key);
    if (!map.has(key)) map.set(key, item);
  }
  return map;
}

/**
 * Groups real simulated objections by exact normalized text and ranks them by the default priority
 * (see `sortObjectionRows`). `rank` (#) follows that order.
 */
export function mapObjectionRows(result: StressTestEvaluatedResultDto): ObjectionRowsResult {
  const assessments = resolutionItemsByKey(result);
  const personas = succeededPersonas(result);
  const groups = new Map<
    string,
    { objection: string; order: number; personas: Map<string, ObjectionPersona> }
  >();
  let total = 0;
  for (const persona of personas) {
    for (const o of persona.critique.objections) {
      total += 1;
      const key = normalizeObjectionText(o.objection);
      if (key.length === 0) continue;
      const group = groups.get(key) ?? {
        objection: o.objection.trim(),
        order: groups.size,
        personas: new Map<string, ObjectionPersona>(),
      };
      const previous = group.personas.get(persona.personaId);
      if (previous === undefined || SEVERITY_RANK[o.severity] > SEVERITY_RANK[previous.severity]) {
        group.personas.set(persona.personaId, {
          personaId: persona.personaId,
          label: persona.personaLabel,
          initials: initialsOf(persona.personaLabel),
          severity: o.severity,
          text: o.objection.trim(),
        });
      }
      groups.set(key, group);
    }
  }
  const unranked = [...groups.entries()].map(([key, g]) =>
    mapObjectionRow(
      { key, objection: g.objection, order: g.order, personas: [...g.personas.values()] },
      personas.length,
      0,
      assessments.get(key),
    ),
  );
  const rows = sortObjectionRows(unranked, "PRIORITY").map((row, i) => ({ ...row, rank: i + 1 }));
  return { rows, totalObjections: total, personasSimulated: personas.length };
}

/* ------------------------------------------------------------------------------------------------
 * Filters / tabs / sort
 * --------------------------------------------------------------------------------------------- */

export type ObjectionSort = "PRIORITY" | "AGREEMENT" | "SEVERITY" | "CATEGORY";

export const OBJECTION_SORT_LABELS: Record<ObjectionSort, string> = {
  PRIORITY: "Prioritas (severity → kesepakatan → dampak AI)",
  AGREEMENT: "Kesepakatan simulasi",
  SEVERITY: "Severity",
  CATEGORY: "Kategori",
};

/** Tab ids: "ALL", `RES_<ResolutionStatus>` (only real, assessed statuses), `SEV_<severity>`. */
export type ObjectionTabId =
  | "ALL"
  | `RES_${Exclude<ResolutionStatus, "NOT_ASSESSED" | "NOT_SOLVABLE_IN_CREATIVE">}`
  | `SEV_${StressTestObjectionSeverity}`;

export interface ObjectionTab {
  readonly id: ObjectionTabId;
  readonly label: string;
  readonly count: number;
}

export interface ObjectionFilterState {
  readonly search: string;
  readonly category: "ALL" | ObjectionCategory;
  readonly severity: "ALL" | StressTestObjectionSeverity;
  /** Persona id or "ALL". */
  readonly persona: string;
  readonly sort: ObjectionSort;
  readonly tab: ObjectionTabId;
}

export const DEFAULT_OBJECTION_FILTERS: ObjectionFilterState = {
  search: "",
  category: "ALL",
  severity: "ALL",
  persona: "ALL",
  sort: "PRIORITY",
  tab: "ALL",
};

export interface ObjectionFilterOptions {
  readonly tabs: readonly ObjectionTab[];
  /** True when no row has an assessed resolution status (legacy runs, or the evaluator did not assess). */
  readonly resolutionNotAssessed: boolean;
  readonly categories: readonly {
    readonly id: ObjectionCategory;
    readonly label: string;
    readonly count: number;
  }[];
  readonly personas: readonly { readonly id: string; readonly label: string }[];
}

/** Resolution tabs, in display order — each appears only when its real count > 0. */
const RESOLUTION_TABS: readonly {
  readonly status: Exclude<ResolutionStatus, "NOT_ASSESSED" | "NOT_SOLVABLE_IN_CREATIVE">;
  readonly label: string;
}[] = [
  { status: "UNRESOLVED", label: "Unresolved" },
  { status: "PARTIAL", label: "Partial" },
  { status: "RESOLVED", label: "Resolved" },
  { status: "REQUIRES_KNOWLEDGE", label: "Butuh Knowledge" },
  { status: "REQUIRES_SALES", label: "Butuh Sales" },
];
const SEVERITIES: readonly StressTestObjectionSeverity[] = ["HIGH", "MEDIUM", "LOW"];

/** Available tabs/options derived from real rows. Resolution tabs appear only when their count > 0. */
export function mapObjectionFilters(rows: readonly ObjectionRow[]): ObjectionFilterOptions {
  const tabs: ObjectionTab[] = [{ id: "ALL", label: "Semua", count: rows.length }];
  for (const { status, label } of RESOLUTION_TABS) {
    const count = rows.filter((r) => r.resolution === status).length;
    if (count > 0) tabs.push({ id: `RES_${status}`, label, count });
  }
  for (const sev of SEVERITIES) {
    const count = rows.filter((r) => r.severity === sev).length;
    if (count > 0) tabs.push({ id: `SEV_${sev}`, label: OBJECTION_SEVERITY_LABELS[sev], count });
  }
  const categoryCounts = new Map<ObjectionCategory, number>();
  for (const r of rows) categoryCounts.set(r.category, (categoryCounts.get(r.category) ?? 0) + 1);
  const personas = new Map<string, string>();
  for (const r of rows) for (const p of r.personas) personas.set(p.personaId, p.label);
  return {
    tabs,
    resolutionNotAssessed: rows.every((r) => r.resolution === "NOT_ASSESSED"),
    categories: [...categoryCounts.entries()].map(([id, count]) => ({
      id,
      label: OBJECTION_CATEGORY_LABELS[id],
      count,
    })),
    personas: [...personas.entries()].map(([id, label]) => ({ id, label })),
  };
}

/**
 * PRIORITY (default) = severity desc -> persona agreement desc -> AI goal impact desc (unassessed = 0)
 * -> open resolution first (UNRESOLVED/PARTIAL/REQUIRES_*) -> first-seen order. Impact and open state
 * are tie-breakers only, so legacy (unassessed) runs keep exactly their previous order.
 */
export function sortObjectionRows(
  rows: readonly ObjectionRow[],
  sort: ObjectionSort,
): readonly ObjectionRow[] {
  const impact = (r: ObjectionRow): number => (r.impact !== undefined ? IMPACT_RANK[r.impact] : 0);
  const open = (r: ObjectionRow): number => (OPEN_RESOLUTIONS.has(r.resolution) ? 1 : 0);
  const prio = (a: ObjectionRow, b: ObjectionRow): number =>
    SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
    b.personaCount - a.personaCount ||
    impact(b) - impact(a) ||
    open(b) - open(a) ||
    a.order - b.order;
  return [...rows].sort((a, b) => {
    switch (sort) {
      case "AGREEMENT":
        return b.agreementPct - a.agreementPct || prio(a, b);
      case "SEVERITY":
        return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.order - b.order;
      case "CATEGORY":
        return a.categoryLabel.localeCompare(b.categoryLabel, "id") || prio(a, b);
      case "PRIORITY":
      default:
        return prio(a, b);
    }
  });
}

export function filterObjectionRows(
  rows: readonly ObjectionRow[],
  state: ObjectionFilterState,
): readonly ObjectionRow[] {
  const q = state.search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (
      q.length > 0 &&
      !r.objection.toLowerCase().includes(q) &&
      !r.personas.some((p) => p.text.toLowerCase().includes(q))
    ) {
      return false;
    }
    if (state.category !== "ALL" && r.category !== state.category) return false;
    if (state.severity !== "ALL" && r.severity !== state.severity) return false;
    if (state.persona !== "ALL" && !r.personas.some((p) => p.personaId === state.persona))
      return false;
    if (state.tab.startsWith("RES_") && r.resolution !== state.tab.slice(4)) return false;
    if (state.tab.startsWith("SEV_") && r.severity !== state.tab.slice(4)) return false;
    return true;
  });
  return sortObjectionRows(filtered, state.sort);
}

/* ------------------------------------------------------------------------------------------------
 * Detail drawer
 * --------------------------------------------------------------------------------------------- */

export interface ObjectionDetail {
  readonly row: ObjectionRow;
  readonly categoryNote: string;
  readonly agreementLabel: string;
  /** Fact-check findings whose normalized claim text EXACTLY equals the normalized objection. */
  readonly relatedFindings: readonly StressTestClaimFindingDto[];
  /** True when the Fact Validator could not run (no Listing Knowledge), or the AI assessed the objection as needing knowledge. */
  readonly needsKnowledge: boolean;
  /** True once the Objection Resolution evaluator actually assessed this row. */
  readonly assessed: boolean;
  readonly liveData: "NOT_CONNECTED";
}

export function mapObjectionDetail(
  row: ObjectionRow,
  result: StressTestEvaluatedResultDto,
): ObjectionDetail {
  const findings = result.factCheck.status === "CHECKED" ? result.factCheck.findings : [];
  return {
    row,
    categoryNote: AUTO_CATEGORY_NOTE,
    agreementLabel: `${String(row.personaCount)}/${String(row.personasSimulated)} persona simulasi (${String(row.agreementPct)}%)`,
    relatedFindings: findings.filter((f) => normalizeObjectionText(f.claim) === row.key),
    needsKnowledge:
      result.factCheck.status === "NOT_APPLICABLE" || row.resolution === "REQUIRES_KNOWLEDGE",
    assessed: row.resolution !== "NOT_ASSESSED",
    liveData: "NOT_CONNECTED",
  };
}

/** Short goal label for the "Dampak ke {goal}" header (parenthetical expansion dropped). */
export function goalShortLabel(goal: StressTestPrimaryGoal): string {
  return (PRIMARY_GOAL_LABELS[goal] ?? goal).replace(/\s*\(.*\)\s*$/, "");
}

/* ------------------------------------------------------------------------------------------------
 * CSV export
 * --------------------------------------------------------------------------------------------- */

export const OBJECTION_CSV_COLUMNS = [
  "objection",
  "category",
  "personas",
  "simulation_agreement",
  "live_frequency",
  "severity",
  "impact",
  "resolution",
  "recommendation",
  "source",
] as const;

export function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** RFC 4180 CSV (CRLF line endings) of the given rows. The caller prepends the UTF-8 BOM when downloading. */
export function objectionsToCsv(rows: readonly ObjectionRow[]): string {
  const lines = rows.map((r) =>
    [
      r.objection,
      r.categoryLabel,
      r.personas.map((p) => p.label).join("; "),
      `${String(r.personaCount)}/${String(r.personasSimulated)} (${String(r.agreementPct)}%)`,
      "",
      r.severity,
      r.impact ?? "",
      r.resolution,
      r.recommendation ?? "",
      "SIMULATION",
    ]
      .map(csvEscape)
      .join(","),
  );
  return [OBJECTION_CSV_COLUMNS.join(","), ...lines].join("\r\n");
}

export function objectionsCsvFilename(runId: string): string {
  return `stress-test-${runId.replace(/[^a-zA-Z0-9_-]/g, "")}-objections.csv`;
}
