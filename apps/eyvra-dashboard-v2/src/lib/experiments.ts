import type { CampaignExperiment } from "./campaign-workspace";
import { experimentProgress } from "./campaign-workspace";
import { presentLabel } from "./presentation";

/**
 * Experiments tab — pure mapper, no JSX. Mirrors `creative-health.ts` / `lead-quality.ts` /
 * `budget.ts` conventions: every field is a real function of the real `AbTest`-shaped
 * `CampaignExperiment[]` (see `campaign-workspace.ts`'s widened type), honest gap when no real
 * backing data exists, no fabricated numbers.
 *
 * Status vocabulary note: the real backend status is `AbTestStatus = "DRAFT" | "RUNNING" |
 * "COMPLETE" | "PAUSED" | "FAILED"` (see `apps/aaos-api/.../abtesting/domain/ab-test.ts`) — NOT the
 * mockup's invented `READY/WAITING_FOR_DATA/WINNER_FOUND/INCONCLUSIVE/STOPPED/COMPLETED/ARCHIVED`
 * vocabulary. `presentExperimentStatus` maps the real status (+ real `winnerVariantId` presence)
 * honestly:
 *  - `RUNNING` -> "Running" (progress-until-threshold, already real via `experimentProgress`).
 *  - `COMPLETE` + real `winnerVariantId` -> "Winner selected" (server already ran `decideWinner`).
 *  - `COMPLETE` without `winnerVariantId` -> "Inconclusive" (real, meaningful "no comparable margin"
 *    state per `decideWinner`'s own doc, not a fabricated status).
 *  - `PAUSED` / `FAILED` -> "Stopped" (both mean the test is no longer running or completing).
 *  - `DRAFT` -> "Draft" (variants' creative packages still generating).
 */
export type ExperimentPresentationStatus =
  "Winner selected" | "Inconclusive" | "Running" | "Stopped" | "Draft";

export function presentExperimentStatus(test: CampaignExperiment): ExperimentPresentationStatus {
  if (test.status === "COMPLETE") return test.winnerVariantId ? "Winner selected" : "Inconclusive";
  if (test.status === "RUNNING") return "Running";
  if (test.status === "DRAFT") return "Draft";
  return "Stopped"; // PAUSED | FAILED
}

export interface ExperimentOverviewCounts {
  readonly total: number;
  readonly running: number;
  readonly winner: number;
  readonly inconclusive: number;
  /** Real `PAUSED` or `FAILED` tests — both mean "no longer running or completing". */
  readonly stopped: number;
  readonly draft: number;
}

/** Real counts computed client-side from the real `tests` array — see status mapping doc above. */
export function experimentOverviewCounts(
  tests: readonly CampaignExperiment[],
): ExperimentOverviewCounts {
  const counts = { total: 0, running: 0, winner: 0, inconclusive: 0, stopped: 0, draft: 0 };
  for (const t of tests) {
    counts.total++;
    if (t.status === "RUNNING") counts.running++;
    else if (t.status === "COMPLETE" && t.winnerVariantId) counts.winner++;
    else if (t.status === "COMPLETE") counts.inconclusive++;
    else if (t.status === "DRAFT") counts.draft++;
    else counts.stopped++; // PAUSED | FAILED
  }
  return counts;
}

/** The real primary metric this backend evaluates winners on — honest label, never "CPQL"/"Hot Lead Rate". */
export const RPH_LEAD_LABEL = "Efisiensi biaya per lead (Rp/lead)";

export function findVariant(test: CampaignExperiment, variantId?: string) {
  return variantId ? test.variants.find((v) => v.id === variantId) : undefined;
}

export function winningVariant(test: CampaignExperiment) {
  return findVariant(test, test.winnerVariantId);
}

/** Real per-variant Rp/lead when the backend already computed it, else a real spend/leads fallback. */
export function variantRphLead(v: CampaignExperiment["variants"][number]): number | undefined {
  if (v.rphLead !== undefined) return v.rphLead;
  return v.leads > 0 ? v.spend / v.leads : undefined;
}

/** Row-level "Hasil" — real winner + real improvementPct, real Inconclusive, or an honest "no result yet". */
export function experimentResultLabel(test: CampaignExperiment): string {
  const status = presentExperimentStatus(test);
  if (status === "Winner selected") {
    return test.improvementPct !== undefined
      ? `Winner ${test.improvementPct}% lebih efisien (Rp/lead)`
      : "Winner selected";
  }
  if (status === "Inconclusive") return "Inconclusive";
  if (status === "Running") return "Belum ada hasil";
  return "-"; // Stopped | Draft
}

export interface ExperimentResultsSummary {
  /** Number of real COMPLETE tests with a real winner and a real improvementPct. */
  readonly count: number;
  readonly averageImprovementPct?: number;
}

/** Only `rphLead`-derived results are real — every other metric (Hot Lead Rate/CPQL/…) is an honest gap. */
export function experimentResultsSummary(
  tests: readonly CampaignExperiment[],
): ExperimentResultsSummary {
  const withWinner = tests.filter(
    (t): t is CampaignExperiment & { improvementPct: number } =>
      t.status === "COMPLETE" && !!t.winnerVariantId && t.improvementPct !== undefined,
  );
  if (!withWinner.length) return { count: 0 };
  const sum = withWinner.reduce((n, t) => n + t.improvementPct, 0);
  return { count: withWinner.length, averageImprovementPct: Math.round(sum / withWinner.length) };
}

/**
 * Real learnings — one sentence per real COMPLETE+winner test, built only from real
 * `winnerVariantId`/`improvementPct`/variant `angle` values. Gated by real data existing (see
 * `experimentResultsSummary`) — empty array is an honest gap, not a fabricated learning.
 */
export function experimentLearnings(tests: readonly CampaignExperiment[]): string[] {
  return tests
    .filter((t) => t.status === "COMPLETE" && t.winnerVariantId)
    .map((t) => {
      const winner = winningVariant(t);
      const others = t.variants.filter((v) => v.id !== t.winnerVariantId);
      if (!winner) return `${t.name}: winner ditentukan, detail varian belum tersedia.`;
      const winnerAngle = presentLabel(winner.angle);
      // Only one other real variant exists -> safe to name it directly. More than one -> stay
      // honest, since the real backend response doesn't expose which specific variant was the
      // runner-up (only the winner's own rphLead/improvementPct against the best runner-up).
      if (others.length === 1 && others[0]) {
        const otherAngle = presentLabel(others[0].angle);
        return t.improvementPct !== undefined
          ? `Angle ${winnerAngle} mengalahkan angle ${otherAngle} dengan Rp/lead ${t.improvementPct}% lebih baik (${t.name}).`
          : `Angle ${winnerAngle} terpilih sebagai winner dibanding angle ${otherAngle} (${t.name}).`;
      }
      return t.improvementPct !== undefined
        ? `Angle ${winnerAngle} unggul Rp/lead ${t.improvementPct}% dibanding varian lain pada ${t.name}.`
        : `Angle ${winnerAngle} terpilih sebagai winner pada ${t.name}.`;
    });
}

/** Real angles present in the creative gallery but never used as a variant angle in any real test. */
export function untestedAngles(
  galleryAngles: readonly string[],
  tests: readonly CampaignExperiment[],
): string[] {
  const tested = new Set(tests.flatMap((t) => t.variants.map((v) => v.angle)));
  return galleryAngles.filter((a) => !tested.has(a));
}

export interface SamanthaExperimentRecommendation {
  readonly summary: string;
  readonly keyInsights: readonly string[];
}

/**
 * Hero narrative — built only from real, computable signals already on this page (counts, real
 * completed-experiment `improvementPct`, real untested-angle gap). No stored recommendation engine
 * exists server-side (confirmed gap) — every bullet here must be traceable to a real field or it is
 * omitted, never filled with placeholder text matching a mockup's exact wording.
 */
export function buildSamanthaExperimentRecommendation(
  tests: readonly CampaignExperiment[],
  galleryAngles: readonly string[],
): SamanthaExperimentRecommendation {
  const counts = experimentOverviewCounts(tests);
  const results = experimentResultsSummary(tests);
  const gaps = untestedAngles(galleryAngles, tests);
  const summary = counts.total
    ? `${counts.total} eksperimen tercatat pada campaign ini — ${counts.running} sedang berjalan, ${counts.winner} dengan winner, ${counts.inconclusive} inconclusive.`
    : "Belum ada eksperimen pada campaign ini.";
  const keyInsights: string[] = [];
  if (results.count && results.averageImprovementPct !== undefined) {
    keyInsights.push(
      `Rata-rata winner mengungguli varian lain ${results.averageImprovementPct}% Rp/lead dari ${results.count} eksperimen selesai.`,
    );
  }
  if (gaps.length) {
    keyInsights.push(
      `${gaps.length} angle creative (${gaps.map(presentLabel).join(", ")}) belum pernah diuji dalam eksperimen.`,
    );
  }
  if (counts.running) {
    keyInsights.push(
      `${counts.running} eksperimen sedang berjalan, menunggu ambang spend/durasi terpenuhi (${counts.running === 1 ? "progress" : "progress masing-masing"} terlihat pada tabel di bawah).`,
    );
  }
  return { summary, keyInsights };
}

export type ExperimentStatusFilter = "All" | ExperimentPresentationStatus;

export function filterExperiments(
  tests: readonly CampaignExperiment[],
  filters: { search?: string; status?: ExperimentStatusFilter },
): CampaignExperiment[] {
  return tests.filter((t) => {
    if (filters.status && filters.status !== "All" && presentExperimentStatus(t) !== filters.status)
      return false;
    if (filters.search) {
      const haystack = [t.id, t.name, ...t.variants.map((v) => v.angle)].join(" ").toLowerCase();
      if (!haystack.includes(filters.search.toLowerCase())) return false;
    }
    return true;
  });
}

export type ExperimentSortKey = "progress" | "createdAt" | "improvementPct";

/** Sorts by real fields only — `experimentProgress` (already real), `createdAt`, `improvementPct`. */
export function sortExperiments(
  tests: readonly CampaignExperiment[],
  sortKey: ExperimentSortKey,
): CampaignExperiment[] {
  const copy = [...tests];
  if (sortKey === "createdAt") {
    return copy.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  if (sortKey === "improvementPct") {
    return copy.sort((a, b) => (b.improvementPct ?? -1) - (a.improvementPct ?? -1));
  }
  return copy.sort((a, b) => experimentProgress(b) - experimentProgress(a));
}

/**
 * "Lihat Arsip" mechanism note: there is no separate archive storage for experiments in this
 * codebase — this filters to real tests that are no longer actively running (`COMPLETE` /
 * `PAUSED` / `FAILED`), presented honestly as the "archive" view rather than implying a distinct
 * archive exists.
 */
export function archivedExperiments(tests: readonly CampaignExperiment[]): CampaignExperiment[] {
  return tests.filter(
    (t) => t.status === "COMPLETE" || t.status === "PAUSED" || t.status === "FAILED",
  );
}

/** Static, non-data-dependent template descriptions — CTAs stay inert per the Second Boundary. */
export interface ExperimentTemplate {
  readonly key: string;
  readonly title: string;
  readonly description: string;
}

export const EXPERIMENT_TEMPLATES: ExperimentTemplate[] = [
  {
    key: "angle",
    title: "Creative Angle Test",
    description:
      "Uji dua atau lebih angle pesan (mis. Investasi vs DP Ringan) pada creative yang sama.",
  },
  {
    key: "format",
    title: "Format Test",
    description: "Uji format creative berbeda (gambar vs video) dengan angle dan copy yang sama.",
  },
  {
    key: "copy-cta",
    title: "Copy-CTA Test",
    description: "Uji variasi headline, primary text, atau call-to-action pada creative yang sama.",
  },
  {
    key: "audience",
    title: "Audience Test",
    description: "Uji ad set dengan target audiens berbeda untuk creative dan angle yang sama.",
  },
  {
    key: "landing",
    title: "Landing Test",
    description:
      "Uji tujuan traffic berbeda (mis. WhatsApp vs landing page) untuk creative yang sama.",
  },
  {
    key: "from-winner",
    title: "Dari Creative Winner",
    description:
      "Mulai eksperimen baru dari creative berstatus Winner pada Creative Health untuk mencari angle berikutnya.",
  },
];
