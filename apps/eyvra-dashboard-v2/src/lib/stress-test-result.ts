/**
 * Creative Stress Test — "decision workspace" result-page mappers. Pure functions, no JSX, no I/O,
 * no LLM: every value returned here is derived deterministically from real fields already present
 * on a persisted `StressTestRunDto` / `StressTestEvaluatedResultDto` (or on the real listing /
 * creative-package responses the page fetches for context). When a field has no real source the
 * mapper returns an explicit gap marker (`undefined` / `"NOT_EVALUATED"` / `"NOT_CONNECTED"`) — the
 * component renders it as "—" / "N/A" / "Belum tersedia", never as an invented value.
 *
 * Presentation-only boundary: nothing here re-scores the creative. Scores, bucket, confidence and
 * `primaryRecommendation` are read verbatim from the backend result.
 */
import {
  CLAIM_STATUS_LABELS,
  DIMENSION_LABELS,
  type PersonaPresetId,
  type StressTestClaimFindingDto,
  type StressTestCopyDimensionDto,
  type StressTestCopyEvaluationResultDto,
  type StressTestDimensionKey,
  type StressTestEvaluatedResultDto,
  type StressTestMode,
  type StressTestObjectionSeverity,
  type StressTestPersonaAttemptDto,
  type StressTestPrimaryGoal,
  type StressTestRunDto,
  type StressTestScoreBucket,
  type StressTestSourceType,
} from "@/lib/stress-test";

/* ------------------------------------------------------------------------------------------------
 * Evidence source badges
 * --------------------------------------------------------------------------------------------- */

/** Where a finding on the page comes from. There is deliberately no `LIVE_DATA` member — no live
 * performance data backs any Creative Stress Test result. */
export type EvidenceKind = "SIMULATED" | "KNOWLEDGE" | "LISTING_DATA" | "UNVERIFIED";

export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  SIMULATED: "SIMULATED",
  KNOWLEDGE: "KNOWLEDGE",
  LISTING_DATA: "LISTING DATA",
  UNVERIFIED: "UNVERIFIED",
};

export const EVIDENCE_DESCRIPTIONS: Record<EvidenceKind, string> = {
  SIMULATED: "Berasal dari simulasi persona AI — bukan pernyataan pembeli nyata.",
  KNOWLEDGE: "Divalidasi terhadap dokumen Listing Knowledge nyata.",
  LISTING_DATA: "Diambil dari data listing yang tersimpan.",
  UNVERIFIED: "Klaim tidak didukung dokumen Listing Knowledge yang tersedia.",
};

/** Fact-check finding -> evidence badge. SUPPORTED/CONFLICTING are grounded in real knowledge
 * documents (a conflict is itself knowledge-backed evidence); UNSUPPORTED has no grounding. */
export function evidenceForClaim(finding: StressTestClaimFindingDto): EvidenceKind {
  return finding.status === "UNSUPPORTED_CLAIM" ? "UNVERIFIED" : "KNOWLEDGE";
}

/* ------------------------------------------------------------------------------------------------
 * Score bucket / severity presentation
 * --------------------------------------------------------------------------------------------- */

export type Tone = "success" | "info" | "warning" | "critical" | "neutral";

export const SCORE_BUCKET_TONE: Record<StressTestScoreBucket, Tone> = {
  READY_TO_TEST: "success",
  MINOR_REVISION: "info",
  NEEDS_REVISION: "warning",
  MAJOR_ISSUES: "critical",
};

export const SEVERITY_RANK: Record<StressTestObjectionSeverity, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const SEVERITY_TONE: Record<StressTestObjectionSeverity, Tone> = {
  HIGH: "critical",
  MEDIUM: "warning",
  LOW: "neutral",
};

/* ------------------------------------------------------------------------------------------------
 * Run timing
 * --------------------------------------------------------------------------------------------- */

/** Real createdAt -> completedAt duration, e.g. "1 mnt 23 dtk". `undefined` when not completed or
 * the timestamps are unusable. */
export function formatRunDuration(
  createdAt: string,
  completedAt: string | undefined,
): string | undefined {
  if (completedAt === undefined) return undefined;
  const start = Date.parse(createdAt);
  const end = Date.parse(completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return undefined;
  const totalSeconds = Math.round((end - start) / 1000);
  if (totalSeconds < 60) return `${String(totalSeconds)} dtk`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${String(minutes)} mnt ${String(seconds)} dtk`;
  const hours = Math.floor(minutes / 60);
  return `${String(hours)} jam ${String(minutes % 60)} mnt`;
}

/* ------------------------------------------------------------------------------------------------
 * Dimension grid (8 mockup labels, only 4 have a real evaluator)
 * --------------------------------------------------------------------------------------------- */

export type DimensionCell =
  | {
      readonly kind: "SCORED";
      readonly label: string;
      readonly dimension: StressTestDimensionKey;
      readonly score: number;
    }
  /** A real evaluator exists for this dimension, but it produced no score on THIS run (evaluator failed). */
  | {
      readonly kind: "NO_SCORE_THIS_RUN";
      readonly label: string;
      readonly dimension: StressTestDimensionKey;
    }
  /** No evaluator exists for this dimension at all — rendered "N/A", never 0 or a number. */
  | { readonly kind: "NOT_EVALUATED"; readonly label: string };

const DIMENSION_GRID: readonly {
  readonly label: string;
  readonly dimension?: StressTestDimensionKey;
}[] = [
  { label: "Hook & Attention", dimension: "HOOK" },
  { label: "Offer & Value", dimension: "OFFER" },
  { label: "CTA", dimension: "CTA" },
  { label: "Objection Handling", dimension: "OBJECTION_HANDLING" },
  { label: "Visual Relevance" },
  { label: "Message-Market Fit" },
  { label: "Trust & Proof" },
  { label: "Campaign Fit" },
];

export function buildDimensionGrid(result: StressTestEvaluatedResultDto): readonly DimensionCell[] {
  return DIMENSION_GRID.map(({ label, dimension }): DimensionCell => {
    if (dimension === undefined) return { kind: "NOT_EVALUATED", label };
    const scored = result.dimensionScores.find((d) => d.dimension === dimension);
    return scored === undefined
      ? { kind: "NO_SCORE_THIS_RUN", label, dimension }
      : { kind: "SCORED", label, dimension, score: scored.score };
  });
}

const COPY_FIELD_BY_DIMENSION: Partial<
  Record<StressTestDimensionKey, "hookClarity" | "offerStrength" | "ctaSpecificity">
> = {
  HOOK: "hookClarity",
  OFFER: "offerStrength",
  CTA: "ctaSpecificity",
};

export interface DimensionEvidence {
  readonly copyReasoning?: StressTestCopyDimensionDto;
  /** Real simulated objections (OBJECTION_HANDLING only) — each tagged with its persona. */
  readonly objections: readonly {
    readonly objection: string;
    readonly severity: StressTestObjectionSeverity;
    readonly personaLabel: string;
  }[];
}

/** Real evidence behind one real dimension score, for the dimension drawer. */
export function dimensionEvidence(
  result: StressTestEvaluatedResultDto,
  dimension: StressTestDimensionKey,
): DimensionEvidence {
  if (dimension === "OBJECTION_HANDLING") {
    return {
      objections: succeededPersonas(result)
        .flatMap((p) => p.critique.objections.map((o) => ({ ...o, personaLabel: p.personaLabel })))
        .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]),
    };
  }
  const field = COPY_FIELD_BY_DIMENSION[dimension];
  const copyReasoning =
    field !== undefined && result.copyEvaluation.ok ? result.copyEvaluation[field] : undefined;
  return { ...(copyReasoning !== undefined ? { copyReasoning } : {}), objections: [] };
}

/* ------------------------------------------------------------------------------------------------
 * Persona helpers
 * --------------------------------------------------------------------------------------------- */

type SucceededPersona = StressTestPersonaAttemptDto & {
  readonly critique: NonNullable<StressTestPersonaAttemptDto["critique"]>;
};

export function succeededPersonas(
  result: StressTestEvaluatedResultDto,
): readonly SucceededPersona[] {
  return result.personaCritiques.filter(
    (p): p is SucceededPersona => p.ok && p.critique !== undefined,
  );
}

/**
 * Presentation tag per configured persona PRESET — describes what the preset is configured to
 * focus on (see aaos-api `persona-presets.ts` descriptions). It is NOT a measured segment and NOT a
 * ranking ("Paling Kritis" is deliberately not used — it would imply a measured comparison).
 */
export const PERSONA_PRESET_TAGS: Record<PersonaPresetId, string> = {
  PRICE_SENSITIVE: "Sensitif Harga",
  SKEPTICAL_BUYER: "Skeptis",
  HIGH_INTENT: "Potensi Tinggi",
  INVESTOR: "Fokus ROI",
  FAMILY_BUYER: "Keluarga",
};

export interface PersonaSummary {
  readonly topAttraction?: string;
  readonly topConfusion?: string;
  readonly topObjection?: {
    readonly objection: string;
    readonly severity: StressTestObjectionSeverity;
  };
  readonly topIntentDriver?: string;
}

/** First real item of each list; the objection is the highest-severity one (ties keep LLM order). */
export function summarizePersona(attempt: StressTestPersonaAttemptDto): PersonaSummary {
  const critique = attempt.critique;
  if (!attempt.ok || critique === undefined) return {};
  const topObjection = [...critique.objections].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  )[0];
  return {
    ...(critique.attracts[0] !== undefined ? { topAttraction: critique.attracts[0] } : {}),
    ...(critique.confusions[0] !== undefined ? { topConfusion: critique.confusions[0] } : {}),
    ...(topObjection !== undefined ? { topObjection } : {}),
    ...(critique.intentDrivers[0] !== undefined
      ? { topIntentDriver: critique.intentDrivers[0] }
      : {}),
  };
}

/* ------------------------------------------------------------------------------------------------
 * Objection aggregation
 * --------------------------------------------------------------------------------------------- */

/** Normalization used for grouping: lowercase, collapse whitespace, strip surrounding quotes and
 * trailing punctuation. Nothing semantic (no synonym/embedding/LLM clustering).
 * KEEP IN SYNC: aaos-api `modules/creative-stress-test/domain/objection-grouping.ts` holds a
 * byte-identical copy; its output is the `objectionResolution.items[].key` rows are joined on. */
export function normalizeObjectionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/[.!?,;:\s]+$/g, "")
    .trim();
}

export interface AggregatedObjection {
  readonly key: string;
  /** Original text of the first occurrence. */
  readonly objection: string;
  /** Highest real severity any persona assigned. */
  readonly severity: StressTestObjectionSeverity;
  readonly personas: readonly {
    readonly personaLabel: string;
    readonly severity: StressTestObjectionSeverity;
  }[];
  /** Number of distinct simulated personas raising this objection. */
  readonly personaCount: number;
  /** Denominator = personas whose simulation actually succeeded on this run. */
  readonly personasSimulated: number;
}

export interface ObjectionAggregation {
  readonly rows: readonly AggregatedObjection[];
  readonly totalObjections: number;
  readonly uniqueObjections: number;
  readonly personasSimulated: number;
}

/**
 * Groups real simulated objections across personas by exact normalized text match. The DTO has no
 * category field, so no category is inferred. Sorted by personaCount desc, then severity desc, then
 * first-seen order. No percentage is ever computed — "kesepakatan simulasi" is a count out of the
 * personas that were actually simulated.
 */
export function aggregateObjections(result: StressTestEvaluatedResultDto): ObjectionAggregation {
  const personas = succeededPersonas(result);
  const groups = new Map<
    string,
    {
      objection: string;
      order: number;
      personas: Map<string, StressTestObjectionSeverity>;
    }
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
        personas: new Map<string, StressTestObjectionSeverity>(),
      };
      const previous = group.personas.get(persona.personaId);
      if (previous === undefined || SEVERITY_RANK[o.severity] > SEVERITY_RANK[previous]) {
        group.personas.set(persona.personaId, o.severity);
      }
      groups.set(key, group);
    }
  }
  const labelById = new Map(personas.map((p) => [p.personaId as string, p.personaLabel]));
  const rows = [...groups.entries()]
    .map(([key, g]) => {
      const personaRows = [...g.personas.entries()].map(([id, severity]) => ({
        personaLabel: labelById.get(id) ?? id,
        severity,
      }));
      const severity = personaRows.reduce<StressTestObjectionSeverity>(
        (max, p) => (SEVERITY_RANK[p.severity] > SEVERITY_RANK[max] ? p.severity : max),
        "LOW",
      );
      return {
        row: {
          key,
          objection: g.objection,
          severity,
          personas: personaRows,
          personaCount: personaRows.length,
          personasSimulated: personas.length,
        } satisfies AggregatedObjection,
        order: g.order,
      };
    })
    .sort(
      (a, b) =>
        b.row.personaCount - a.row.personaCount ||
        SEVERITY_RANK[b.row.severity] - SEVERITY_RANK[a.row.severity] ||
        a.order - b.order,
    )
    .map((x) => x.row);
  return {
    rows,
    totalObjections: total,
    uniqueObjections: rows.length,
    personasSimulated: personas.length,
  };
}

/* ------------------------------------------------------------------------------------------------
 * Deterministic priority list
 * --------------------------------------------------------------------------------------------- */

export type PriorityItemSource =
  "FACT_CONFLICT" | "UNSUPPORTED_CLAIM" | "COPY_DIMENSION" | "OBJECTION";

export interface PriorityItem {
  readonly id: string;
  readonly source: PriorityItemSource;
  readonly title: string;
  readonly detail: string;
  /** Source badge. Omitted for copy-evaluator items: an AI copy critique is neither a persona
   * simulation nor knowledge-backed, so no badge from the fixed set would be honest. */
  readonly evidence?: EvidenceKind;
  /** 3 = high, 2 = medium, 1 = low — see `buildPriorityList` doc for how each source maps. */
  readonly severityRank: number;
  /** Distinct simulated personas raising it (objections only; 0 otherwise). */
  readonly personasAffected: number;
  /** The real backend dimension score this item relates to, when one exists. */
  readonly dimensionScore?: number;
}

const COPY_STATUS_RANK = { WEAK: 3, ADEQUATE: 2, STRONG: 0 } as const;

const COPY_DIMENSIONS: readonly {
  readonly field: "hookClarity" | "offerStrength" | "ctaSpecificity" | "internalConsistency";
  readonly label: string;
  readonly dimension?: StressTestDimensionKey;
}[] = [
  { field: "hookClarity", label: "Hook", dimension: "HOOK" },
  { field: "offerStrength", label: "Offer", dimension: "OFFER" },
  { field: "ctaSpecificity", label: "CTA", dimension: "CTA" },
  { field: "internalConsistency", label: "Konsistensi internal" },
];

const SOURCE_TIEBREAK: Record<PriorityItemSource, number> = {
  FACT_CONFLICT: 0,
  COPY_DIMENSION: 1,
  OBJECTION: 2,
  UNSUPPORTED_CLAIM: 3,
};

export const PRIORITY_LIST_MAX = 5;

/**
 * Deterministic "what to fix first" list — candidates come ONLY from real result fields:
 *
 * - `CONFLICTING_CLAIM` fact findings  -> severity 3 (the backend's own primaryRecommendation also
 *   puts a conflicting claim above everything else).
 * - WEAK / ADEQUATE copy-evaluator dimensions (Hook, Offer, CTA, Konsistensi internal) -> severity
 *   3 / 2 with the evaluator's real reasoning; STRONG dimensions are never listed. The related real
 *   dimension score (35 / 65 per the backend's disclosed mapping) is attached when one exists.
 * - Aggregated simulated objections (see `aggregateObjections`) -> their highest real severity
 *   (HIGH 3 / MEDIUM 2 / LOW 1), `personasAffected` = distinct personas; attached dimension score =
 *   the real OBJECTION_HANDLING score.
 * - `UNSUPPORTED_CLAIM` fact findings -> severity 2.
 *
 * Ranking: severity desc -> personasAffected desc -> dimension score asc (missing last) -> source
 * order (fact conflict, copy, objection, unsupported claim) -> first-seen order. Capped at
 * `PRIORITY_LIST_MAX`; fewer real findings means fewer items (possibly zero). No LLM, no invented items.
 */
export function buildPriorityList(result: StressTestEvaluatedResultDto): readonly PriorityItem[] {
  const candidates: PriorityItem[] = [];
  const scoreOf = (d: StressTestDimensionKey): number | undefined =>
    result.dimensionScores.find((s) => s.dimension === d)?.score;

  const findings = result.factCheck.status === "CHECKED" ? result.factCheck.findings : [];
  findings.forEach((f, i) => {
    if (f.status === "CONFLICTING_CLAIM") {
      candidates.push({
        id: `fact-conflict-${String(i)}`,
        source: "FACT_CONFLICT",
        title: `Perbaiki klaim "${f.claim}"`,
        detail: `${CLAIM_STATUS_LABELS[f.status]} dengan Listing Knowledge — ${f.reasoning}`,
        evidence: "KNOWLEDGE",
        severityRank: 3,
        personasAffected: 0,
      });
    }
  });

  if (result.copyEvaluation.ok) {
    for (const { field, label, dimension } of COPY_DIMENSIONS) {
      const dim = result.copyEvaluation[field];
      if (dim === undefined || dim.status === "STRONG") continue;
      const score = dimension !== undefined ? scoreOf(dimension) : undefined;
      candidates.push({
        id: `copy-${field}`,
        source: "COPY_DIMENSION",
        title: `Perkuat ${label}`,
        detail: dim.reasoning,
        severityRank: COPY_STATUS_RANK[dim.status],
        personasAffected: 0,
        ...(score !== undefined ? { dimensionScore: score } : {}),
      });
    }
  }

  const objectionScore = scoreOf("OBJECTION_HANDLING");
  for (const row of aggregateObjections(result).rows) {
    candidates.push({
      id: `objection-${row.key}`,
      source: "OBJECTION",
      title: `Jawab keberatan: "${row.objection}"`,
      detail: `Muncul pada ${String(row.personaCount)}/${String(row.personasSimulated)} persona simulasi (${row.personas
        .map((p) => p.personaLabel)
        .join(", ")}).`,
      evidence: "SIMULATED",
      severityRank: SEVERITY_RANK[row.severity],
      personasAffected: row.personaCount,
      ...(objectionScore !== undefined ? { dimensionScore: objectionScore } : {}),
    });
  }

  findings.forEach((f, i) => {
    if (f.status === "UNSUPPORTED_CLAIM") {
      candidates.push({
        id: `fact-unsupported-${String(i)}`,
        source: "UNSUPPORTED_CLAIM",
        title: `Buktikan atau hapus klaim "${f.claim}"`,
        detail: `${CLAIM_STATUS_LABELS[f.status]} oleh Listing Knowledge — ${f.reasoning}`,
        evidence: "UNVERIFIED",
        severityRank: 2,
        personasAffected: 0,
      });
    }
  });

  return candidates
    .map((item, order) => ({ item, order }))
    .sort(
      (a, b) =>
        b.item.severityRank - a.item.severityRank ||
        b.item.personasAffected - a.item.personasAffected ||
        (a.item.dimensionScore ?? Number.POSITIVE_INFINITY) -
          (b.item.dimensionScore ?? Number.POSITIVE_INFINITY) ||
        SOURCE_TIEBREAK[a.item.source] - SOURCE_TIEBREAK[b.item.source] ||
        a.order - b.order,
    )
    .slice(0, PRIORITY_LIST_MAX)
    .map((x) => x.item);
}

/* ------------------------------------------------------------------------------------------------
 * Evaluator + data coverage
 * --------------------------------------------------------------------------------------------- */

export type EvaluatorState = "SUCCEEDED" | "PARTIAL" | "FAILED" | "NOT_RUN" | "NOT_AVAILABLE";

export interface EvaluatorCoverageRow {
  readonly label: string;
  readonly state: EvaluatorState;
  readonly note?: string;
}

export interface EvaluatorCoverage {
  /** Real evaluators (persona simulation, copy, fact validator) that were attempted AND succeeded. */
  readonly succeeded: number;
  /** Real evaluators actually attempted on this run — unavailable evaluators are never counted. */
  readonly attempted: number;
  readonly rows: readonly EvaluatorCoverageRow[];
}

/** Evaluators the product plans but that do not exist in the backend — listed as "Belum tersedia". */
export const UNAVAILABLE_EVALUATORS: readonly string[] = [
  "Visual Evaluator",
  "Campaign Strategy Evaluator",
  "Creative Strategy Evaluator",
];

/**
 * Evaluator-level coverage over the 3 REAL evaluators:
 * - Buyer Persona Simulation: attempted when ≥1 persona was simulated; succeeded when ≥1 persona
 *   produced a real critique (PARTIAL when some failed).
 * - Copy Evaluator: always attempted; succeeded when `copyEvaluation.ok`.
 * - Fact / Claim Validator: `NOT_APPLICABLE` means it never ran (no Listing Knowledge) -> NOT_RUN and
 *   excluded from the denominator; `CHECKED` succeeded; `FAILED` attempted-but-failed.
 * Planned-but-nonexistent evaluators are appended as NOT_AVAILABLE and never counted.
 */
export function computeEvaluatorCoverage(result: StressTestEvaluatedResultDto): EvaluatorCoverage {
  const rows: EvaluatorCoverageRow[] = [];
  let attempted = 0;
  let succeeded = 0;

  const personaTotal = result.personaCritiques.length;
  const personaOk = result.personaCritiques.filter((p) => p.ok).length;
  if (personaTotal === 0) {
    rows.push({ label: "Buyer Persona Simulation", state: "NOT_RUN" });
  } else {
    attempted += 1;
    if (personaOk > 0) succeeded += 1;
    rows.push({
      label: "Buyer Persona Simulation",
      state: personaOk === 0 ? "FAILED" : personaOk < personaTotal ? "PARTIAL" : "SUCCEEDED",
      note: `${String(personaOk)}/${String(personaTotal)} persona berhasil`,
    });
  }

  attempted += 1;
  if (result.copyEvaluation.ok) succeeded += 1;
  rows.push({
    label: "Copy Evaluator",
    state: result.copyEvaluation.ok ? "SUCCEEDED" : "FAILED",
    ...(result.copyEvaluation.failureReason !== undefined
      ? { note: result.copyEvaluation.failureReason }
      : {}),
  });

  if (result.factCheck.status === "NOT_APPLICABLE") {
    rows.push({
      label: "Fact / Claim Validator",
      state: "NOT_RUN",
      note: "Tidak ada Listing Knowledge untuk divalidasi",
    });
  } else {
    attempted += 1;
    if (result.factCheck.status === "CHECKED") succeeded += 1;
    rows.push({
      label: "Fact / Claim Validator",
      state: result.factCheck.status === "CHECKED" ? "SUCCEEDED" : "FAILED",
    });
  }

  // Objection Resolution (AI): absent on legacy runs / SKIPPED -> NOT_RUN, never counted.
  const resolution = result.objectionResolution;
  if (resolution === undefined || resolution.status === "SKIPPED") {
    rows.push({
      label: "Objection Resolution (AI)",
      state: "NOT_RUN",
      note: resolution === undefined ? "Belum dinilai pada run ini" : resolution.note,
    });
  } else {
    attempted += 1;
    if (resolution.status === "ASSESSED") succeeded += 1;
    rows.push({
      label: "Objection Resolution (AI)",
      state: resolution.status === "ASSESSED" ? "SUCCEEDED" : "FAILED",
      ...(resolution.status === "FAILED" ? { note: resolution.note } : {}),
    });
  }

  for (const label of UNAVAILABLE_EVALUATORS) {
    rows.push({ label, state: "NOT_AVAILABLE" });
  }
  return { succeeded, attempted, rows };
}

export type DataCoverageState = "AVAILABLE" | "MISSING" | "NOT_CONNECTED";

export interface DataCoverageRow {
  readonly label: string;
  readonly state: DataCoverageState;
}

/**
 * Which real inputs fed this run. Listing = the run (or its resolved creative package) carries a
 * real listing that loaded; Creative = at least one of the run's `creativeIds` resolved to real
 * metadata; Knowledge = the Fact Validator actually checked against Listing Knowledge. First
 * Message / Respon Pintar / Historical Meta are never wired into the evaluator -> NOT_CONNECTED.
 */
export function computeDataCoverage(input: {
  readonly listingLoaded: boolean;
  readonly creativeResolved: boolean;
  readonly result?: StressTestEvaluatedResultDto;
}): readonly DataCoverageRow[] {
  return [
    { label: "Listing", state: input.listingLoaded ? "AVAILABLE" : "MISSING" },
    { label: "Creative", state: input.creativeResolved ? "AVAILABLE" : "MISSING" },
    {
      label: "Knowledge",
      state: input.result?.factCheck.status === "CHECKED" ? "AVAILABLE" : "MISSING",
    },
    { label: "First Message", state: "NOT_CONNECTED" },
    { label: "Respon Pintar", state: "NOT_CONNECTED" },
    { label: "Historical Meta", state: "NOT_CONNECTED" },
  ];
}

/* ------------------------------------------------------------------------------------------------
 * Knowledge gaps ("Butuh bukti dulu")
 * --------------------------------------------------------------------------------------------- */

export interface KnowledgeGap {
  readonly id: string;
  readonly text: string;
  readonly evidence: EvidenceKind;
}

/** Real claims that need proof before Kai reuses them: every UNSUPPORTED_CLAIM finding, or — when
 * the Fact Validator never ran — the real NOT_APPLICABLE note (all claims unverified). */
export function buildKnowledgeGaps(result: StressTestEvaluatedResultDto): readonly KnowledgeGap[] {
  if (result.factCheck.status === "NOT_APPLICABLE") {
    return [{ id: "not-applicable", text: result.factCheck.note, evidence: "UNVERIFIED" }];
  }
  if (result.factCheck.status !== "CHECKED") return [];
  return result.factCheck.findings
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.status === "UNSUPPORTED_CLAIM")
    .map(({ f, i }) => ({
      id: `unsupported-${String(i)}`,
      text: `"${f.claim}" — ${f.reasoning}`,
      evidence: "UNVERIFIED" as const,
    }));
}

/** Splits the existing `composeKaiBrief` output back into its real Pertahankan/Ubah/Hindari
 * sections for a read-only preview (the drawer still receives the full composed text). */
export function parseKaiBriefSections(
  brief: string,
): readonly { readonly heading: string; readonly lines: readonly string[] }[] {
  const sections: { heading: string; lines: string[] }[] = [];
  let current: { heading: string; lines: string[] } | undefined;
  for (const raw of brief.split("\n")) {
    const line = raw.trim();
    const heading = /^(Pertahankan|Ubah|Hindari):$/.exec(line);
    if (heading?.[1] !== undefined) {
      current = { heading: heading[1], lines: [] };
      sections.push(current);
    } else if (current !== undefined && line.startsWith("- ")) {
      current.lines.push(line.slice(2));
    }
  }
  return sections;
}

/* ------------------------------------------------------------------------------------------------
 * Context: listing + creative metadata
 * --------------------------------------------------------------------------------------------- */

/** Subset of aaos-api `ListingResponseDto` the context card reads. Every field optional/unknown on
 * the wire — parsed defensively via `parseListingContext`. */
export interface ListingContext {
  readonly id: string;
  readonly title: string;
  readonly price?: number;
  readonly landArea?: number;
  readonly buildArea?: number;
  readonly certificate?: string;
  readonly city?: string;
  readonly province?: string;
  readonly listingStatus?: string;
  readonly description?: string;
  readonly mainPhotoUrl?: string;
  readonly photos: readonly {
    readonly id: string;
    readonly url: string;
    readonly isMain: boolean;
  }[];
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function parseListingContext(body: unknown): ListingContext | undefined {
  if (body === null || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  const id = str(b.id);
  const title = str(b.title);
  if (id === undefined || title === undefined) return undefined;
  const photos = Array.isArray(b.photos)
    ? b.photos.flatMap((p: unknown) => {
        if (p === null || typeof p !== "object") return [];
        const pr = p as Record<string, unknown>;
        const pid = str(pr.id);
        const url = str(pr.url);
        return pid !== undefined && url !== undefined
          ? [{ id: pid, url, isMain: pr.isMain === true }]
          : [];
      })
    : [];
  const optional = {
    price: num(b.price),
    landArea: num(b.landArea),
    buildArea: num(b.buildArea),
    certificate: str(b.certificate),
    city: str(b.city),
    province: str(b.province),
    listingStatus: str(b.listingStatus),
    description: str(b.description),
    mainPhotoUrl: str(b.mainPhotoUrl),
  };
  return {
    id,
    title,
    photos,
    ...Object.fromEntries(Object.entries(optional).filter(([, v]) => v !== undefined)),
  } as ListingContext;
}

/** Real creative-package shape subset (`CampaignPackage` from `/api/campaigns/[id]/workspace`). */
export interface PackageLike {
  readonly id: string;
  readonly title?: string;
  readonly angle?: string;
  readonly decidedFormat?: string;
  readonly requestedFormat?: string;
  readonly imageUrls?: readonly string[];
  readonly listingId?: string;
  readonly copyVariants?: readonly { readonly primaryText?: string; readonly headline?: string }[];
}

export interface CreativeInfo {
  readonly id: string;
  readonly thumbnailUrl?: string;
  readonly title: string;
  readonly sourceLabel: "Listing" | "Creative Package";
  readonly format?: string;
  readonly angle?: string;
  readonly headline?: string;
  readonly primaryText?: string;
  /** True for the creative whose text the backend actually evaluated (first resolving package). */
  readonly evaluated: boolean;
}

export interface CreativeInfoResult {
  readonly creatives: readonly CreativeInfo[];
  /** The real text the backend fed to the evaluators, when it can be reconstructed from real data. */
  readonly copyPreview?: {
    readonly headline?: string;
    readonly primaryText?: string;
    readonly description?: string;
    readonly isProxyFromListing: boolean;
  };
}

/**
 * Resolves the run's real `creativeIds` to metadata, mirroring `CreativeStressTestService.
 * resolveCreativeUnderTest` (read-only mirror, no scoring): LISTING -> ids are listing photo ids and
 * the evaluated text is the listing title/description/price proxy; CAMPAIGN/CREATIVE_PACKAGE -> ids
 * are creative package ids and the FIRST that resolves is the one evaluated.
 */
export function resolveCreativeInfo(input: {
  readonly sourceType: StressTestSourceType;
  readonly creativeIds: readonly string[];
  readonly listing?: ListingContext;
  readonly packages?: readonly PackageLike[];
}): CreativeInfoResult {
  if (input.sourceType === "LISTING") {
    const listing = input.listing;
    if (listing === undefined) return { creatives: [] };
    const creatives = input.creativeIds.flatMap((id): CreativeInfo[] => {
      const photo = listing.photos.find((p) => p.id === id);
      return photo === undefined
        ? []
        : [
            {
              id,
              thumbnailUrl: photo.url,
              title: photo.isMain ? "Foto utama listing" : "Foto listing",
              sourceLabel: "Listing",
              format: "Foto listing",
              evaluated: false,
            },
          ];
    });
    return {
      creatives,
      copyPreview: {
        headline: listing.title,
        ...(listing.price !== undefined
          ? { primaryText: `Harga: Rp ${listing.price.toLocaleString("id-ID")}` }
          : {}),
        ...(listing.description !== undefined ? { description: listing.description } : {}),
        isProxyFromListing: true,
      },
    };
  }
  if (input.sourceType === "CAMPAIGN" || input.sourceType === "CREATIVE_PACKAGE") {
    const packages = input.packages ?? [];
    let evaluatedAssigned = false;
    const creatives = input.creativeIds.flatMap((id): CreativeInfo[] => {
      const pkg = packages.find((p) => p.id === id);
      if (pkg === undefined) return [];
      const variant = pkg.copyVariants?.[0];
      const evaluated = !evaluatedAssigned;
      evaluatedAssigned = true;
      const format = pkg.decidedFormat ?? pkg.requestedFormat;
      return [
        {
          id,
          ...(pkg.imageUrls?.[0] !== undefined ? { thumbnailUrl: pkg.imageUrls[0] } : {}),
          title: pkg.title ?? "Creative package",
          sourceLabel: "Creative Package",
          ...(format !== undefined ? { format } : {}),
          ...(pkg.angle !== undefined ? { angle: pkg.angle } : {}),
          ...(str(variant?.headline) !== undefined ? { headline: variant?.headline } : {}),
          ...(str(variant?.primaryText) !== undefined ? { primaryText: variant?.primaryText } : {}),
          evaluated,
        },
      ];
    });
    const first = creatives.find((c) => c.evaluated);
    return {
      creatives,
      ...(first !== undefined && (first.headline !== undefined || first.primaryText !== undefined)
        ? {
            copyPreview: {
              ...(first.headline !== undefined ? { headline: first.headline } : {}),
              ...(first.primaryText !== undefined ? { primaryText: first.primaryText } : {}),
              isProxyFromListing: false,
            },
          }
        : {}),
    };
  }
  return { creatives: [] };
}

/* ------------------------------------------------------------------------------------------------
 * Run again / duplicate prefill
 * --------------------------------------------------------------------------------------------- */

export type PrefillIntent = "rerun" | "duplicate";

export function buildRunAgainHref(runId: string, intent: PrefillIntent): string {
  return `/samantha/stress-test/run?fromRun=${encodeURIComponent(runId)}&intent=${intent}`;
}

export interface BuilderPrefill {
  readonly name: string;
  readonly sourceType: "LISTING" | "CAMPAIGN";
  readonly listingId: string;
  readonly campaignId: string;
  readonly creativeIds: readonly string[];
  readonly mode: StressTestMode;
  readonly primaryGoal: StressTestPrimaryGoal;
  readonly personaIds: readonly PersonaPresetId[];
  readonly objectionSources: StressTestRunDto["objectionSources"];
}

/** Builder form state from a real prior run's settings. Only the builder's two supported source
 * types are prefilled; other source types return `undefined` (the builder then starts empty). */
export function buildPrefillFromRun(
  run: StressTestRunDto,
  intent: PrefillIntent,
): BuilderPrefill | undefined {
  if (run.sourceType !== "LISTING" && run.sourceType !== "CAMPAIGN") return undefined;
  return {
    name: intent === "duplicate" ? `${run.name} (salinan)` : run.name,
    sourceType: run.sourceType,
    listingId: run.sourceType === "LISTING" ? (run.listingId ?? "") : "",
    campaignId: run.sourceType === "CAMPAIGN" ? (run.campaignId ?? "") : "",
    creativeIds: run.creativeIds,
    mode: run.mode,
    primaryGoal: run.primaryGoal,
    personaIds: run.personaIds,
    objectionSources: run.objectionSources,
  };
}

/* ------------------------------------------------------------------------------------------------
 * Compare runs
 * --------------------------------------------------------------------------------------------- */

export function evaluatedResultOf(run: StressTestRunDto): StressTestEvaluatedResultDto | undefined {
  return run.result?.kind === "COMPLETED" ? run.result : undefined;
}

export interface CompareCandidate {
  readonly run: StressTestRunDto;
  readonly sameContext: boolean;
}

/** Other real runs with an evaluated result, newest first; runs on the same listing/campaign first. */
export function compareCandidates(
  current: StressTestRunDto,
  runs: readonly StressTestRunDto[],
): readonly CompareCandidate[] {
  return runs
    .filter((r) => r.id !== current.id && evaluatedResultOf(r) !== undefined)
    .map((run) => ({
      run,
      sameContext:
        (current.listingId !== undefined && run.listingId === current.listingId) ||
        (current.campaignId !== undefined && run.campaignId === current.campaignId),
    }))
    .sort(
      (a, b) =>
        Number(b.sameContext) - Number(a.sameContext) ||
        Date.parse(b.run.createdAt) - Date.parse(a.run.createdAt),
    );
}

export interface RunComparisonRow {
  readonly label: string;
  readonly current?: number;
  readonly other?: number;
  /** current - other; undefined when either side has no real score. */
  readonly delta?: number;
}

export interface RunComparison {
  readonly overall: RunComparisonRow;
  readonly currentBucket: StressTestScoreBucket | null;
  readonly otherBucket: StressTestScoreBucket | null;
  readonly dimensions: readonly RunComparisonRow[];
  readonly uniqueObjections: RunComparisonRow;
}

function row(
  label: string,
  current: number | undefined,
  other: number | undefined,
): RunComparisonRow {
  return {
    label,
    ...(current !== undefined ? { current } : {}),
    ...(other !== undefined ? { other } : {}),
    ...(current !== undefined && other !== undefined ? { delta: current - other } : {}),
  };
}

export function compareRuns(
  current: StressTestEvaluatedResultDto,
  other: StressTestEvaluatedResultDto,
): RunComparison {
  const dims: readonly StressTestDimensionKey[] = ["HOOK", "OFFER", "CTA", "OBJECTION_HANDLING"];
  const scoreOf = (
    r: StressTestEvaluatedResultDto,
    d: StressTestDimensionKey,
  ): number | undefined => r.dimensionScores.find((s) => s.dimension === d)?.score;
  return {
    overall: row(
      "Creative Readiness Score",
      current.overallScore ?? undefined,
      other.overallScore ?? undefined,
    ),
    currentBucket: current.scoreBucket,
    otherBucket: other.scoreBucket,
    dimensions: dims.map((d) => row(DIMENSION_LABELS[d], scoreOf(current, d), scoreOf(other, d))),
    uniqueObjections: row(
      "Keberatan unik (simulasi)",
      aggregateObjections(current).uniqueObjections,
      aggregateObjections(other).uniqueObjections,
    ),
  };
}

/** The 4 real Copy Evaluator dimensions, in display order. */
export const COPY_EVALUATOR_DIMENSIONS: readonly {
  readonly key: keyof Pick<
    StressTestCopyEvaluationResultDto,
    "hookClarity" | "offerStrength" | "ctaSpecificity" | "internalConsistency"
  >;
  readonly label: string;
}[] = [
  { key: "hookClarity", label: "Hook Clarity" },
  { key: "offerStrength", label: "Offer Strength" },
  { key: "ctaSpecificity", label: "CTA Specificity" },
  { key: "internalConsistency", label: "Internal Consistency" },
];
