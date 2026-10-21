import { describe, expect, it } from "vitest";
import type { StressTestEvaluatedResultDto, StressTestRunDto } from "@/lib/stress-test";
import {
  aggregateObjections,
  buildDimensionGrid,
  buildKnowledgeGaps,
  buildPrefillFromRun,
  buildPriorityList,
  buildRunAgainHref,
  compareCandidates,
  compareRuns,
  computeDataCoverage,
  computeEvaluatorCoverage,
  evidenceForClaim,
  formatRunDuration,
  normalizeObjectionText,
  parseKaiBriefSections,
  parseListingContext,
  resolveCreativeInfo,
  summarizePersona,
} from "@/lib/stress-test-result";
import { composeKaiBrief } from "@/lib/stress-test";

function persona(
  personaId: StressTestEvaluatedResultDto["personaCritiques"][number]["personaId"],
  personaLabel: string,
  objections: { objection: string; severity: "HIGH" | "MEDIUM" | "LOW" }[],
): StressTestEvaluatedResultDto["personaCritiques"][number] {
  return {
    personaId,
    personaLabel,
    ok: true,
    critique: {
      simulated: true,
      attracts: ["Lokasi strategis", "Dekat tol"],
      confusions: [],
      objections,
      intentDrivers: ["Promo DP"],
      narrativeReaction: "Reaksi.",
    },
  };
}

const RESULT: StressTestEvaluatedResultDto = {
  kind: "COMPLETED",
  personaCritiques: [
    persona("PRICE_SENSITIVE", "Price Sensitive", [
      { objection: "Harga terlalu tinggi", severity: "MEDIUM" },
      { objection: "DP tidak disebut", severity: "LOW" },
    ]),
    persona("SKEPTICAL_BUYER", "Skeptical Buyer", [
      { objection: "  harga TERLALU tinggi. ", severity: "HIGH" },
      { objection: "Legalitas belum jelas", severity: "HIGH" },
    ]),
    persona("INVESTOR", "Investor", [{ objection: "Harga terlalu tinggi!", severity: "LOW" }]),
    {
      personaId: "FAMILY_BUYER",
      personaLabel: "Family Buyer",
      ok: false,
      failureReason: "PROVIDER_ERROR: boom",
    },
  ],
  copyEvaluation: {
    ok: true,
    hookClarity: { status: "STRONG", reasoning: "Hook kuat." },
    offerStrength: { status: "ADEQUATE", reasoning: "Offer kurang spesifik." },
    ctaSpecificity: { status: "WEAK", reasoning: "Tidak ada CTA." },
    internalConsistency: { status: "WEAK", reasoning: "Harga di headline dan body berbeda." },
  },
  factCheck: {
    status: "CHECKED",
    note: "Diperiksa.",
    findings: [
      { claim: "SHM", status: "SUPPORTED", reasoning: "Sesuai dokumen." },
      { claim: "5 menit ke tol", status: "UNSUPPORTED_CLAIM", reasoning: "Tidak ada di dokumen." },
      { claim: "Luas 200m2", status: "CONFLICTING_CLAIM", reasoning: "Dokumen menyebut 120m2." },
    ],
  },
  dimensionScores: [
    { dimension: "HOOK", score: 90 },
    { dimension: "OFFER", score: 65 },
    { dimension: "CTA", score: 35 },
    { dimension: "OBJECTION_HANDLING", score: 62 },
  ],
  overallScore: 63,
  scoreBucket: "NEEDS_REVISION",
  confidence: 75,
  primaryRecommendation: "Prioritas utama: klaim bertentangan.",
  evaluatorsAttempted: 5,
  evaluatorsSucceeded: 4,
  gaps: [],
};

describe("aggregateObjections", () => {
  it("groups by normalized exact text, counts distinct personas out of personas actually simulated, keeps the highest real severity", () => {
    const agg = aggregateObjections(RESULT);
    expect(agg.personasSimulated).toBe(3);
    expect(agg.totalObjections).toBe(5);
    expect(agg.uniqueObjections).toBe(3);
    const [top] = agg.rows;
    expect(top?.objection).toBe("Harga terlalu tinggi");
    expect(top?.personaCount).toBe(3);
    expect(top?.personasSimulated).toBe(3);
    expect(top?.severity).toBe("HIGH");
    expect(top?.personas.map((p) => p.personaLabel)).toEqual([
      "Price Sensitive",
      "Skeptical Buyer",
      "Investor",
    ]);
  });

  it("never computes a percentage or a category", () => {
    for (const row of aggregateObjections(RESULT).rows) {
      expect(Object.keys(row).sort()).toEqual(
        ["key", "objection", "personaCount", "personas", "personasSimulated", "severity"].sort(),
      );
    }
  });

  it("does not merge objections that only share meaning, not text", () => {
    const r: StressTestEvaluatedResultDto = {
      ...RESULT,
      personaCritiques: [
        persona("PRICE_SENSITIVE", "A", [{ objection: "Harga mahal", severity: "LOW" }]),
        persona("INVESTOR", "B", [{ objection: "Harganya kemahalan", severity: "LOW" }]),
      ],
    };
    expect(aggregateObjections(r).uniqueObjections).toBe(2);
  });

  it("normalizes case, whitespace, quotes and trailing punctuation only", () => {
    expect(normalizeObjectionText('  "Harga   Tinggi!!" ')).toBe("harga tinggi");
  });
});

describe("buildPriorityList", () => {
  const items = buildPriorityList(RESULT);

  // Explicit expected order under the documented rule:
  // severity 3: objection "harga" (3 personas), objection "legalitas" (1 persona, OH score 62),
  //             copy CTA (0 personas, score 35), fact conflict (0, no score), internal consistency (0, no score, copy source)
  const ranking = [
    "objection-harga terlalu tinggi",
    "objection-legalitas belum jelas",
    "copy-ctaSpecificity",
    "fact-conflict-2",
    "copy-internalConsistency",
  ];

  it("follows the documented order exactly and caps at 5", () => {
    expect(items.map((i) => i.id)).toEqual(ranking);
    expect(items).toHaveLength(5);
  });

  it("never lists STRONG copy dimensions and carries real evidence badges", () => {
    expect(items.some((i) => i.id === "copy-hookClarity")).toBe(false);
    expect(items.find((i) => i.source === "OBJECTION")?.evidence).toBe("SIMULATED");
    expect(items.find((i) => i.source === "FACT_CONFLICT")?.evidence).toBe("KNOWLEDGE");
    expect(items.find((i) => i.source === "COPY_DIMENSION")?.evidence).toBeUndefined();
  });

  it("returns fewer items (or none) when there are fewer real findings", () => {
    const clean: StressTestEvaluatedResultDto = {
      ...RESULT,
      personaCritiques: [persona("INVESTOR", "Investor", [])],
      copyEvaluation: {
        ok: true,
        hookClarity: { status: "STRONG", reasoning: "a" },
        offerStrength: { status: "STRONG", reasoning: "b" },
        ctaSpecificity: { status: "STRONG", reasoning: "c" },
        internalConsistency: { status: "STRONG", reasoning: "d" },
      },
      factCheck: { status: "NOT_APPLICABLE", note: "n/a", findings: [] },
    };
    expect(buildPriorityList(clean)).toEqual([]);
    const oneUnsupported: StressTestEvaluatedResultDto = {
      ...clean,
      factCheck: {
        status: "CHECKED",
        note: "",
        findings: [{ claim: "X", status: "UNSUPPORTED_CLAIM", reasoning: "r" }],
      },
    };
    const only = buildPriorityList(oneUnsupported);
    expect(only).toHaveLength(1);
    expect(only[0]?.evidence).toBe("UNVERIFIED");
  });
});

describe("buildDimensionGrid", () => {
  it("returns the 8 mockup labels with N/A for the 4 dimensions that have no evaluator — never a number", () => {
    const grid = buildDimensionGrid(RESULT);
    expect(grid.map((c) => c.label)).toEqual([
      "Hook & Attention",
      "Offer & Value",
      "CTA",
      "Objection Handling",
      "Visual Relevance",
      "Message-Market Fit",
      "Trust & Proof",
      "Campaign Fit",
    ]);
    const unevaluated = grid.slice(4);
    for (const cell of unevaluated) {
      expect(cell.kind).toBe("NOT_EVALUATED");
      expect("score" in cell).toBe(false);
    }
    expect(grid[2]).toEqual({ kind: "SCORED", label: "CTA", dimension: "CTA", score: 35 });
  });

  it("marks a real dimension with no score on this run distinctly from N/A", () => {
    const grid = buildDimensionGrid({
      ...RESULT,
      dimensionScores: [{ dimension: "HOOK", score: 90 }],
    });
    expect(grid[3]).toEqual({
      kind: "NO_SCORE_THIS_RUN",
      label: "Objection Handling",
      dimension: "OBJECTION_HANDLING",
    });
  });
});

describe("computeEvaluatorCoverage", () => {
  it("counts only the 3 real evaluators; planned ones are NOT_AVAILABLE and excluded from the denominator", () => {
    const cov = computeEvaluatorCoverage(RESULT);
    expect(cov.attempted).toBe(3);
    expect(cov.succeeded).toBe(3);
    expect(cov.rows.find((r) => r.label === "Buyer Persona Simulation")?.state).toBe("PARTIAL");
    expect(cov.rows.filter((r) => r.state === "NOT_AVAILABLE").map((r) => r.label)).toEqual([
      "Visual Evaluator",
      "Campaign Strategy Evaluator",
      "Creative Strategy Evaluator",
    ]);
  });

  it("excludes a NOT_APPLICABLE fact validator from the denominator and counts failures", () => {
    const cov = computeEvaluatorCoverage({
      ...RESULT,
      copyEvaluation: { ok: false, failureReason: "boom" },
      factCheck: { status: "NOT_APPLICABLE", note: "n/a", findings: [] },
    });
    expect(cov.attempted).toBe(2);
    expect(cov.succeeded).toBe(1);
    expect(cov.rows.find((r) => r.label === "Fact / Claim Validator")?.state).toBe("NOT_RUN");
    expect(cov.rows.find((r) => r.label === "Copy Evaluator")?.state).toBe("FAILED");
  });

  it("counts a FAILED fact validator as attempted but not succeeded", () => {
    const cov = computeEvaluatorCoverage({
      ...RESULT,
      factCheck: { status: "FAILED", note: "x", findings: [] },
    });
    expect(cov.attempted).toBe(3);
    expect(cov.succeeded).toBe(2);
  });
});

describe("computeDataCoverage", () => {
  it("marks Listing/Creative/Knowledge from real inputs and the rest as not connected", () => {
    expect(
      computeDataCoverage({ listingLoaded: true, creativeResolved: false, result: RESULT }),
    ).toEqual([
      { label: "Listing", state: "AVAILABLE" },
      { label: "Creative", state: "MISSING" },
      { label: "Knowledge", state: "AVAILABLE" },
      { label: "First Message", state: "NOT_CONNECTED" },
      { label: "Respon Pintar", state: "NOT_CONNECTED" },
      { label: "Historical Meta", state: "NOT_CONNECTED" },
    ]);
    const notApplicable = computeDataCoverage({
      listingLoaded: false,
      creativeResolved: true,
      result: { ...RESULT, factCheck: { status: "NOT_APPLICABLE", note: "", findings: [] } },
    });
    expect(notApplicable[2]).toEqual({ label: "Knowledge", state: "MISSING" });
  });
});

describe("evidence + knowledge gaps", () => {
  it("maps claim status to evidence honestly", () => {
    expect(evidenceForClaim({ claim: "a", status: "SUPPORTED", reasoning: "" })).toBe("KNOWLEDGE");
    expect(evidenceForClaim({ claim: "a", status: "UNSUPPORTED_CLAIM", reasoning: "" })).toBe(
      "UNVERIFIED",
    );
  });

  it("lists unsupported claims, or the NOT_APPLICABLE note, as knowledge gaps", () => {
    expect(buildKnowledgeGaps(RESULT).map((g) => g.text)).toEqual([
      '"5 menit ke tol" — Tidak ada di dokumen.',
    ]);
    expect(
      buildKnowledgeGaps({
        ...RESULT,
        factCheck: { status: "NOT_APPLICABLE", note: "Belum ada knowledge.", findings: [] },
      }),
    ).toEqual([{ id: "not-applicable", text: "Belum ada knowledge.", evidence: "UNVERIFIED" }]);
  });

  it("parses the existing composeKaiBrief output into its real sections", () => {
    const sections = parseKaiBriefSections(composeKaiBrief(RESULT));
    expect(sections.map((s) => s.heading)).toEqual(["Pertahankan", "Ubah", "Hindari"]);
    expect(sections[2]?.lines[0]).toContain("Luas 200m2");
  });
});

describe("summarizePersona", () => {
  it("picks the highest-severity real objection and first real items", () => {
    const s = summarizePersona(RESULT.personaCritiques[1]!);
    expect(s.topObjection).toEqual({ objection: "  harga TERLALU tinggi. ", severity: "HIGH" });
    expect(s.topAttraction).toBe("Lokasi strategis");
    expect(s.topConfusion).toBeUndefined();
  });
  it("returns nothing for a failed persona", () => {
    expect(summarizePersona(RESULT.personaCritiques[3]!)).toEqual({});
  });
});

describe("formatRunDuration", () => {
  it("formats real durations and returns undefined without completedAt", () => {
    expect(formatRunDuration("2026-09-28T00:00:00.000Z", "2026-09-28T00:00:42.000Z")).toBe(
      "42 dtk",
    );
    expect(formatRunDuration("2026-09-28T00:00:00.000Z", "2026-09-28T00:01:23.000Z")).toBe(
      "1 mnt 23 dtk",
    );
    expect(formatRunDuration("2026-09-28T00:00:00.000Z", undefined)).toBeUndefined();
  });
});

const RUN: StressTestRunDto = {
  id: "run-1",
  name: "Run 1",
  sourceType: "LISTING",
  listingId: "l-1",
  creativeIds: ["p-2"],
  mode: "DEEP",
  primaryGoal: "HOT_LEAD_RATE",
  personaIds: ["INVESTOR"],
  objectionSources: ["LISTING_KNOWLEDGE_BASE"],
  status: "COMPLETED",
  result: RESULT,
  createdAt: "2026-09-28T00:00:00.000Z",
};

describe("run again / duplicate", () => {
  it("builds the builder href and a prefill from the real run settings", () => {
    expect(buildRunAgainHref("run-1", "rerun")).toBe(
      "/samantha/stress-test/run?fromRun=run-1&intent=rerun",
    );
    expect(buildPrefillFromRun(RUN, "rerun")).toEqual({
      name: "Run 1",
      sourceType: "LISTING",
      listingId: "l-1",
      campaignId: "",
      creativeIds: ["p-2"],
      mode: "DEEP",
      primaryGoal: "HOT_LEAD_RATE",
      personaIds: ["INVESTOR"],
      objectionSources: ["LISTING_KNOWLEDGE_BASE"],
    });
    expect(buildPrefillFromRun(RUN, "duplicate")?.name).toBe("Run 1 (salinan)");
    expect(buildPrefillFromRun({ ...RUN, sourceType: "CAMPAIGN_DRAFT" }, "rerun")).toBeUndefined();
  });
});

describe("compare", () => {
  it("lists only other evaluated runs, same context first then newest", () => {
    const other = { ...RUN, id: "o", listingId: "l-2", createdAt: "2026-09-29T00:00:00.000Z" };
    const same = { ...RUN, id: "s", createdAt: "2026-09-01T00:00:00.000Z" };
    const legacy: StressTestRunDto = {
      ...RUN,
      id: "w",
      status: "WAITING_FOR_ENGINE",
      result: { kind: "WAITING_FOR_ENGINE", reason: "", objectionSourceAvailability: [] },
    };
    expect(compareCandidates(RUN, [RUN, other, same, legacy]).map((c) => c.run.id)).toEqual([
      "s",
      "o",
    ]);
  });

  it("computes real deltas and leaves missing sides undefined", () => {
    const c = compareRuns(RESULT, {
      ...RESULT,
      overallScore: 50,
      dimensionScores: [{ dimension: "CTA", score: 65 }],
    });
    expect(c.overall).toEqual({
      label: "Creative Readiness Score",
      current: 63,
      other: 50,
      delta: 13,
    });
    expect(c.dimensions.find((d) => d.label === "CTA")?.delta).toBe(-30);
    expect(c.dimensions.find((d) => d.label === "Hook")).toEqual({ label: "Hook", current: 90 });
    expect(c.uniqueObjections.delta).toBe(0);
  });
});

describe("context parsing", () => {
  it("parses only real listing fields and rejects non-listing bodies", () => {
    expect(parseListingContext({ id: "run-1", name: "not a listing" })).toBeUndefined();
    const l = parseListingContext({
      id: "l-1",
      title: "Rumah",
      price: 5,
      photos: [{ id: "p-2", url: "u", isMain: false }],
    });
    expect(l).toEqual({
      id: "l-1",
      title: "Rumah",
      price: 5,
      photos: [{ id: "p-2", url: "u", isMain: false }],
    });
  });

  it("resolves listing photos and package metadata from real ids only", () => {
    const listing = parseListingContext({
      id: "l-1",
      title: "Rumah",
      price: 1000,
      photos: [{ id: "p-2", url: "u", isMain: false }],
    })!;
    const fromListing = resolveCreativeInfo({
      sourceType: "LISTING",
      creativeIds: ["p-2", "missing"],
      listing,
    });
    expect(fromListing.creatives).toHaveLength(1);
    expect(fromListing.creatives[0]).toMatchObject({
      title: "Foto listing",
      sourceLabel: "Listing",
    });
    expect(fromListing.copyPreview?.isProxyFromListing).toBe(true);

    const fromPackages = resolveCreativeInfo({
      sourceType: "CAMPAIGN",
      creativeIds: ["nope", "pk-1", "pk-2"],
      packages: [
        {
          id: "pk-1",
          title: "Paket A",
          angle: "DP_RINGAN",
          decidedFormat: "IMAGES_ONLY",
          copyVariants: [{ headline: "H", primaryText: "P" }],
        },
        { id: "pk-2", title: "Paket B" },
      ],
    });
    expect(fromPackages.creatives.map((c) => [c.id, c.evaluated])).toEqual([
      ["pk-1", true],
      ["pk-2", false],
    ]);
    expect(fromPackages.copyPreview).toEqual({
      headline: "H",
      primaryText: "P",
      isProxyFromListing: false,
    });
    expect(
      resolveCreativeInfo({ sourceType: "CAMPAIGN_DRAFT", creativeIds: ["x"] }).creatives,
    ).toEqual([]);
  });
});
