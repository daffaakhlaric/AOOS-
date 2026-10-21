import type { StressTestRunDto, StressTestEvaluatedResultDto } from "./stress-test";
import {
  aggregateObjections,
  buildDimensionGrid,
  dimensionEvidence,
  evaluatedResultOf,
  normalizeObjectionText,
} from "./stress-test-result";

/** Phase 1 read-only comparison projection. Never re-scores or changes persisted runs. */
export function comparisonContext(a: StressTestRunDto, b: StressTestRunDto) {
  const warnings: string[] = [];
  const same = (x?: string, y?: string) => !!x && x === y;
  const related =
    same(a.listingId, b.listingId) ||
    same(a.campaignId, b.campaignId) ||
    same(a.campaignDraftId, b.campaignDraftId) ||
    (a.sourceType === b.sourceType && a.creativeIds.some((id) => b.creativeIds.includes(id)));
  if (!related)
    warnings.push("Run ini menggunakan konteks berbeda dan tidak dapat dibandingkan langsung.");
  if (a.id === b.id) warnings.push("Pilih dua run yang berbeda.");
  if (a.primaryGoal !== b.primaryGoal)
    warnings.push("Primary goal berbeda; selisih skor tidak dihitung.");
  const blocked = !related || a.id === b.id || a.primaryGoal !== b.primaryGoal;
  const set = (values: readonly string[]) => [...new Set(values)].sort().join("|");
  if (a.mode !== b.mode) warnings.push(`Mode berubah: ${a.mode} → ${b.mode}.`);
  if (set(a.personaIds) !== set(b.personaIds)) warnings.push("Persona yang dipilih berbeda.");
  if (set(a.objectionSources) !== set(b.objectionSources))
    warnings.push("Sumber keberatan yang dipilih berbeda.");
  if (a.sourceType !== b.sourceType) warnings.push("Jenis sumber creative berbeda.");
  const ar = evaluatedResultOf(a),
    br = evaluatedResultOf(b);
  if (
    ar &&
    br &&
    set(ar.personaCritiques.filter((p) => p.ok).map((p) => p.personaId)) !==
      set(br.personaCritiques.filter((p) => p.ok).map((p) => p.personaId))
  )
    warnings.push("Cakupan persona yang berhasil dievaluasi berbeda.");
  if (!ar || !br) warnings.push("Salah satu run belum memiliki hasil evaluasi lengkap.");
  // Existing historical contract has no engine/prompt/scoring versions or immutable creative snapshot.
  warnings.push("Versi engine, prompt, dan scoring belum tersimpan pada kontrak run ini.");
  return {
    status: blocked ? ("NOT_DIRECTLY_COMPARABLE" as const) : ("PARTIALLY_COMPARABLE" as const),
    blocked,
    warnings,
  };
}

const numericDelta = (
  a: number | null | undefined,
  b: number | null | undefined,
  allowed: boolean,
) =>
  allowed &&
  typeof a === "number" &&
  typeof b === "number" &&
  Number.isFinite(a) &&
  Number.isFinite(b)
    ? Math.round((b - a) * 100) / 100
    : null;
function summary(result?: StressTestEvaluatedResultDto) {
  if (!result) return { total: null, unresolved: null, partial: null, resolved: null, other: null };
  const aggregation = aggregateObjections(result);
  const items =
    result.objectionResolution?.status === "ASSESSED"
      ? result.objectionResolution.items
      : undefined;
  return {
    total: aggregation.personasSimulated ? aggregation.uniqueObjections : null,
    unresolved: items ? items.filter((o) => o.resolutionStatus === "UNRESOLVED").length : null,
    partial: items ? items.filter((o) => o.resolutionStatus === "PARTIAL").length : null,
    resolved: items ? items.filter((o) => o.resolutionStatus === "RESOLVED").length : null,
    other: items
      ? items.filter((o) => !["UNRESOLVED", "PARTIAL", "RESOLVED"].includes(o.resolutionStatus))
          .length
      : null,
  };
}
function facts(result?: StressTestEvaluatedResultDto) {
  return result?.factCheck.status === "CHECKED"
    ? {
        verified: result.factCheck.findings.filter((f) => f.status === "SUPPORTED").length,
        unsupported: result.factCheck.findings.filter((f) => f.status === "UNSUPPORTED_CLAIM")
          .length,
        conflicting: result.factCheck.findings.filter((f) => f.status === "CONFLICTING_CLAIM")
          .length,
      }
    : null;
}

export function compareSimulationRuns(runA: StressTestRunDto, runB: StressTestRunDto) {
  const a = evaluatedResultOf(runA),
    b = evaluatedResultOf(runB);
  const comparability = comparisonContext(runA, runB);
  const allowed = !comparability.blocked && !!a && !!b;
  const gridA = a ? buildDimensionGrid(a) : [];
  const gridB = b ? buildDimensionGrid(b) : [];
  const dimensions = [
    "Hook & Attention",
    "Offer & Value",
    "CTA",
    "Objection Handling",
    "Visual Relevance",
    "Message-Market Fit",
    "Trust & Proof",
    "Campaign Fit",
  ].map((label) => {
    const x = gridA.find((d) => d.label === label),
      y = gridB.find((d) => d.label === label);
    const scoreA = x?.kind === "SCORED" ? x.score : null,
      scoreB = y?.kind === "SCORED" ? y.score : null;
    return {
      label,
      scoreA,
      scoreB,
      delta: numericDelta(scoreA, scoreB, allowed),
      evidenceA: a && x && "dimension" in x ? dimensionEvidence(a, x.dimension) : null,
      evidenceB: b && y && "dimension" in y ? dimensionEvidence(b, y.dimension) : null,
    };
  });
  const aa = a ? aggregateObjections(a) : undefined,
    ba = b ? aggregateObjections(b) : undefined;
  const keys = new Set([
    ...(aa?.rows.map((o) => o.key) ?? []),
    ...(ba?.rows.map((o) => o.key) ?? []),
  ]);
  const objections = [...keys]
    .map((key) => {
      const x = aa?.rows.find((o) => o.key === key),
        y = ba?.rows.find((o) => o.key === key);
      const resolutionA =
        a?.objectionResolution?.status === "ASSESSED"
          ? a.objectionResolution.items.find((o) => o.key === key)
          : undefined;
      const resolutionB =
        b?.objectionResolution?.status === "ASSESSED"
          ? b.objectionResolution.items.find((o) => o.key === key)
          : undefined;
      const proportionA =
        x && x.personasSimulated ? x.personaCount / x.personasSimulated : undefined;
      const proportionB =
        y && y.personasSimulated ? y.personaCount / y.personasSimulated : undefined;
      const delta = numericDelta(proportionA, proportionB, allowed);
      let status = "Tidak dapat dibandingkan";
      if (allowed) {
        if (!x) status = "Baru teramati";
        else if (!y) status = "Tidak muncul di Run B";
        else if (
          resolutionB?.resolutionStatus === "RESOLVED" &&
          resolutionA?.resolutionStatus !== "RESOLVED"
        )
          status = "Terjawab menurut evaluator";
        else if (delta !== null)
          status =
            delta < 0 ? "Agreement menurun" : delta > 0 ? "Agreement meningkat" : "Tidak berubah";
      }
      return {
        key,
        text: x?.objection ?? y?.objection ?? key,
        a: x ?? null,
        b: y ?? null,
        resolutionA: resolutionA ?? null,
        resolutionB: resolutionB ?? null,
        status,
        delta,
      };
    })
    .sort(
      (x, y) =>
        Math.max(y.a?.personaCount ?? 0, y.b?.personaCount ?? 0) -
        Math.max(x.a?.personaCount ?? 0, x.b?.personaCount ?? 0),
    );
  const summaryA = summary(a),
    summaryB = summary(b);
  const regressions = dimensions.filter((d) => d.delta !== null && d.delta < 0);
  const improvements = dimensions.filter((d) => d.delta !== null && d.delta > 0);
  const previousClaims = new Map(
    (a?.factCheck.findings ?? []).map((f) => [normalizeObjectionText(f.claim), f.status]),
  );
  const newClaimRisks =
    allowed && a?.factCheck.status === "CHECKED" && b?.factCheck.status === "CHECKED"
      ? b.factCheck.findings.filter(
          (f) =>
            f.status !== "SUPPORTED" &&
            previousClaims.get(normalizeObjectionText(f.claim)) !== f.status,
        )
      : [];
  const overallDelta = numericDelta(a?.overallScore, b?.overallScore, allowed);
  const insight = !allowed
    ? "Konteks atau hasil run belum mendukung perbandingan langsung. Pilih dua run yang sesuai sebelum menafsirkan perubahan."
    : `Selisih skor ${overallDelta === null ? "belum tersedia" : `${overallDelta > 0 ? "+" : ""}${overallDelta}`} poin. ${improvements.length} dimensi naik dan ${regressions.length} dimensi turun. ${newClaimRisks.length ? `${newClaimRisks.length} klaim berisiko baru/perubahan status perlu diperiksa.` : "Periksa bukti dan keberatan yang tersisa sebelum menerima creative."} Perbedaan ini belum membuktikan peningkatan performa Meta.`;
  return {
    runA,
    runB,
    comparability,
    overallDelta,
    dimensions,
    objections,
    summaryA,
    summaryB,
    summaryDeltas: Object.fromEntries(
      Object.keys(summaryA).map((k) => {
        const key = k as keyof typeof summaryA;
        return [key, numericDelta(summaryA[key], summaryB[key], allowed)];
      }),
    ),
    factsA: facts(a),
    factsB: facts(b),
    regressions,
    improvements,
    newClaimRisks,
    insight,
  };
}
export type SimulationComparison = ReturnType<typeof compareSimulationRuns>;
