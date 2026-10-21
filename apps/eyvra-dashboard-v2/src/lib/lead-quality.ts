import type { CampaignLead } from "./campaign-workspace";

/**
 * Lead Quality tab — pure mapper, no JSX. Mirrors `creative-health.ts`'s conventions: every number
 * here is a real function of `leads` (this app's own `CampaignLead[]`, see `campaign-workspace.ts`).
 * Nothing here computes CPQL, appointment, survey, or booking counts — this codebase has verified NO
 * real data source for any of those (see `apps/aaos-api/.../campaign-health.ts`'s own doc comments,
 * "leadQuality ALWAYS UNKNOWN"). Callers must render those as honest "—", never derive them here.
 *
 * "Qualified" vs "Hot" — this codebase's REAL distinction: `CampaignLead.temperature` is a 3-bucket
 * score classification (`COLD | WARM | HOT`, see `packages/lead-store`'s `classifyTemperature`).
 * There is no separate "QUALIFIED" workflow stage in `LeadStatus` — so "Qualified" here means the
 * real, strictly real subset of leads whose latest score bucket cleared COLD (WARM or HOT), and
 * "Hot" is the real, strictly stricter subset that reached the HOT bucket. Both are genuinely
 * distinguishable in the real `temperature` field; neither is invented.
 */

export const MIN_LEAD_SAMPLE = 5;

export type LeadFunnelStageKey =
  "raw" | "contacted" | "qualified" | "hot" | "appointment" | "survey" | "booking";

export interface LeadFunnelStage {
  readonly key: LeadFunnelStageKey;
  readonly label: string;
  /** `undefined` = honest gap (no real data source), never a fabricated 0. */
  readonly value?: number;
  /**
   * Real % change vs. the previous REAL stage (positive = drop-off, negative = the stage grew vs.
   * the previous one — that can genuinely happen here since `contacted` and `temperature` are
   * independent real fields, not a causal pipeline). `undefined` when either side of the comparison
   * isn't a real number, or the previous real stage's value is 0 (nothing to divide by).
   */
  readonly dropOffPct?: number;
}

/**
 * Raw → Contacted → Qualified → Hot are real, computed from `leads`. Appointment/Survey/Booking are
 * kept as explicit stages (matching the reference's structure) but their `value` stays `undefined` —
 * this codebase has no CRM event source for any of the three (confirmed absolute backend gap).
 */
export function buildLeadFunnel(leads?: readonly CampaignLead[]): LeadFunnelStage[] {
  const raw = leads?.length;
  const contacted = leads?.filter((l) => l.contacted).length;
  const qualified = leads?.filter(
    (l) => l.temperature === "WARM" || l.temperature === "HOT",
  ).length;
  const hot = leads?.filter((l) => l.temperature === "HOT").length;
  const base: { key: LeadFunnelStageKey; label: string; value?: number }[] = [
    { key: "raw", label: "Raw Leads", value: raw },
    { key: "contacted", label: "Contacted", value: contacted },
    { key: "qualified", label: "Qualified", value: qualified },
    { key: "hot", label: "Hot Leads", value: hot },
    { key: "appointment", label: "Appointment", value: undefined },
    { key: "survey", label: "Survey", value: undefined },
    { key: "booking", label: "Booking", value: undefined },
  ];
  return base.map((stage, i) => {
    const prev = base[i - 1];
    const dropOffPct =
      typeof stage.value === "number" && typeof prev?.value === "number" && prev.value > 0
        ? Math.round((1 - stage.value / prev.value) * 100)
        : undefined;
    return { ...stage, dropOffPct };
  });
}

export interface LeadQualityTrend {
  readonly days: string[];
  /** Real raw-lead count per day, keyed by `createdAt`'s date. */
  readonly rawByDay: number[];
  /** Real qualified(HOT)-event count per day, keyed by `qualifiedAt`'s date — unchanged semantics
   *  from the pre-existing "Quality trend" chart (becameHotAt, not a historical score curve). */
  readonly qualifiedByDay: number[];
  /**
   * Real hot-lead rate per day (`hot events that day / raw leads created that day`) — only for days
   * that had at least one raw lead. `undefined` for a day with zero raw leads (never a fabricated
   * 0% for a day nothing happened), so callers must filter, not zero-fill.
   */
  readonly hotRateByDay: (number | undefined)[];
}

export function leadQualityTrend(leads?: readonly CampaignLead[]): LeadQualityTrend {
  const rawCounts = new Map<string, number>();
  const qualifiedCounts = new Map<string, number>();
  const hotCounts = new Map<string, number>();
  (leads ?? []).forEach((l) => {
    const createdDay = l.createdAt?.slice(0, 10);
    if (createdDay) rawCounts.set(createdDay, (rawCounts.get(createdDay) ?? 0) + 1);
    const qualifiedDay = l.qualifiedAt?.slice(0, 10);
    if (qualifiedDay) {
      qualifiedCounts.set(qualifiedDay, (qualifiedCounts.get(qualifiedDay) ?? 0) + 1);
      if (l.temperature === "HOT")
        hotCounts.set(qualifiedDay, (hotCounts.get(qualifiedDay) ?? 0) + 1);
    }
  });
  const days = [...new Set([...rawCounts.keys(), ...qualifiedCounts.keys()])].sort();
  return {
    days,
    rawByDay: days.map((d) => rawCounts.get(d) ?? 0),
    qualifiedByDay: days.map((d) => qualifiedCounts.get(d) ?? 0),
    hotRateByDay: days.map((d) => {
      const raw = rawCounts.get(d);
      if (!raw) return undefined;
      return ((hotCounts.get(d) ?? 0) / raw) * 100;
    }),
  };
}

export type LeadQualityPosture = "EXCELLENT" | "GOOD" | "WATCH" | "POOR" | "INSUFFICIENT_DATA";

export interface SamanthaLeadQualityAnalysis {
  readonly posture: LeadQualityPosture;
  readonly summary: string;
  readonly recommendation: string;
  readonly keyInsights: string[];
  /** Always shown alongside `posture` — this tab's conclusions are structurally partial (no real
   *  CPQL/appointment/survey/booking source exists anywhere in this codebase), and that's never
   *  omitted just because the early-funnel numbers look good. */
  readonly trackingCaveat: string;
}

const TRACKING_CAVEAT =
  "Analisis ini hanya mencakup Raw Leads, Contacted, dan Qualified/Hot dari CRM. CPQL, Appointment, Survey, dan Booking belum bisa diukur karena integrasi Respon Pintar belum terhubung.";

/**
 * Posture is bucketed purely from real `contacted`/`temperature` rates on `leads` — never a fixed
 * label, never an invented numeric quality score. Thresholds below are a self-disclosed bucketing
 * choice (documented here), not a backend signal, mirroring `creative-health.ts`'s
 * `buildSamanthaCreativeAnalysis` convention. `INSUFFICIENT_DATA` covers both "no leads yet" and a
 * sample too small (`< MIN_LEAD_SAMPLE`) for a contacted/hot rate to mean anything.
 */
export function buildSamanthaLeadQualityAnalysis(
  leads: readonly CampaignLead[] | undefined,
): SamanthaLeadQualityAnalysis {
  const total = leads?.length ?? 0;
  if (!leads || total < MIN_LEAD_SAMPLE) {
    return {
      posture: "INSUFFICIENT_DATA",
      summary:
        total === 0
          ? "Belum ada lead teratribusi ke campaign ini."
          : `Baru ${total} lead teratribusi — minimal ${MIN_LEAD_SAMPLE} diperlukan sebelum contacted rate dan hot rate bisa dibaca dengan andal.`,
      recommendation: "Kumpulkan lebih banyak lead sebelum menilai kualitas funnel campaign ini.",
      keyInsights: [],
      trackingCaveat: TRACKING_CAVEAT,
    };
  }
  const contacted = leads.filter((l) => l.contacted).length;
  const hot = leads.filter((l) => l.temperature === "HOT").length;
  const contactedRate = contacted / total;
  const hotRate = hot / total;
  const posture: LeadQualityPosture =
    contactedRate >= 0.8 && hotRate >= 0.3
      ? "EXCELLENT"
      : contactedRate >= 0.5 && hotRate >= 0.15
        ? "GOOD"
        : contactedRate < 0.3 && hotRate < 0.05
          ? "POOR"
          : "WATCH";
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const summary = `${pct(contactedRate)} dari ${total} lead sudah dikontak; ${pct(hotRate)} mencapai temperature HOT.`;
  const unassignedHot = leads.filter(
    (l) => l.temperature === "HOT" && l.status !== "ASSIGNED" && l.status !== "CLOSED",
  ).length;
  const recommendation =
    posture === "POOR"
      ? "Contacted rate dan hot rate keduanya rendah — prioritaskan follow-up lead yang belum dikontak sebelum menilai kualitas creative/targeting."
      : unassignedHot > 0
        ? `${unassignedHot} HOT lead belum di-assign atau closed — prioritaskan follow-up sebelum menilai langkah berikutnya.`
        : "Contacted rate dan hot rate stabil — pertahankan ritme follow-up saat ini.";
  const keyInsights: string[] = [
    `${contacted} dari ${total} lead teratribusi punya percakapan tercatat.`,
    `${hot} lead mencapai temperature HOT dari ${total} lead teratribusi.`,
  ];
  if (unassignedHot > 0) keyInsights.push(`${unassignedHot} HOT lead belum assigned atau closed.`);
  return { posture, summary, recommendation, keyInsights, trackingCaveat: TRACKING_CAVEAT };
}

/**
 * Real, computed-from-real-`leads` insights only — gated by the same `MIN_LEAD_SAMPLE` sufficiency
 * floor as `buildSamanthaLeadQualityAnalysis`. Median time-to-qualification is only included when at
 * least 2 leads have a real `qualifiedAt` timestamp (a single data point isn't a median).
 */
export function leadQualityInsights(leads?: readonly CampaignLead[]): string[] {
  if (!leads || leads.length < MIN_LEAD_SAMPLE) return [];
  const insights: string[] = [];
  const contactedRate = leads.filter((l) => l.contacted).length / leads.length;
  insights.push(`${Math.round(contactedRate * 100)}% dari lead teratribusi sudah dikontak.`);
  const qualifiedDurationsMs = leads
    .filter((l) => l.qualifiedAt)
    .map((l) => Date.parse(l.qualifiedAt as string) - Date.parse(l.createdAt))
    .filter((ms) => Number.isFinite(ms) && ms >= 0)
    .sort((a, b) => a - b);
  if (qualifiedDurationsMs.length >= 2) {
    const mid = Math.floor(qualifiedDurationsMs.length / 2);
    const medianMs =
      qualifiedDurationsMs.length % 2 === 0
        ? (qualifiedDurationsMs[mid - 1]! + qualifiedDurationsMs[mid]!) / 2
        : qualifiedDurationsMs[mid]!;
    const medianDays = medianMs / 86400000;
    insights.push(
      `Median waktu ke qualifikasi: ${medianDays < 1 ? `${Math.round(medianMs / 3600000)} jam` : `${medianDays.toFixed(1)} hari`}.`,
    );
  }
  return insights;
}
