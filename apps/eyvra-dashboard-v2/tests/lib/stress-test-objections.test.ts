import { describe, expect, it } from "vitest";
import type { StressTestEvaluatedResultDto, StressTestPersonaAttemptDto } from "@/lib/stress-test";
import {
  DEFAULT_OBJECTION_FILTERS,
  classifyObjection,
  csvEscape,
  filterObjectionRows,
  frequencyTone,
  goalShortLabel,
  mapObjectionDetail,
  mapObjectionFilters,
  mapObjectionRows,
  objectionsCsvFilename,
  objectionsToCsv,
} from "@/lib/stress-test-objections";

function persona(
  id: StressTestPersonaAttemptDto["personaId"],
  label: string,
  objections: { objection: string; severity: "HIGH" | "MEDIUM" | "LOW" }[],
): StressTestPersonaAttemptDto {
  return {
    personaId: id,
    personaLabel: label,
    ok: true,
    critique: {
      simulated: true,
      attracts: [],
      confusions: [],
      objections,
      intentDrivers: ["Promo DP"],
      narrativeReaction: "x",
    },
  };
}

const RESULT: StressTestEvaluatedResultDto = {
  kind: "COMPLETED",
  personaCritiques: [
    persona("PRICE_SENSITIVE", "Price Sensitive", [
      { objection: "Harga terlalu tinggi", severity: "MEDIUM" },
      { objection: "Cicilan KPR tidak disebut", severity: "LOW" },
    ]),
    persona("SKEPTICAL_BUYER", "Skeptical Buyer", [
      { objection: "harga terlalu tinggi.", severity: "MEDIUM" },
      { objection: "Sertifikat belum jelas", severity: "HIGH" },
    ]),
    persona("INVESTOR", "Investor", [{ objection: "Harga terlalu tinggi", severity: "LOW" }]),
    {
      personaId: "FAMILY_BUYER",
      personaLabel: "Family Buyer",
      ok: false,
      failureReason: "timeout",
    },
  ],
  copyEvaluation: { ok: false },
  factCheck: {
    status: "CHECKED",
    note: "ok",
    findings: [
      {
        claim: "Sertifikat belum jelas",
        status: "UNSUPPORTED_CLAIM",
        reasoning: "Tidak ada dokumen.",
      },
    ],
  },
  dimensionScores: [],
  overallScore: null,
  scoreBucket: null,
  confidence: 50,
  primaryRecommendation: "x",
  evaluatorsAttempted: 5,
  evaluatorsSucceeded: 3,
  gaps: [],
};

describe("classifyObjection", () => {
  it.each([
    ["Harganya terlalu mahal untuk lokasi ini", "PRICE_VALUE"],
    ["Budget saya tidak cukup", "PRICE_VALUE"],
    ["Legalitas SHM belum jelas", "LEGAL_SECURITY"],
    ["Apakah sudah ada PBG?", "LEGAL_SECURITY"],
    ["DP terlalu besar", "FINANCING"],
    ["Cicilan per bulan tidak disebut", "FINANCING"],
    ["Akses jalan sempit dan rawan banjir", "LOCATION_FACILITIES"],
    ["Jauh dari sekolah", "LOCATION_FACILITIES"],
    ["Saya perlu survey dulu", "SURVEY_VISIT"],
    ["Ingin lihat langsung unitnya", "SURVEY_VISIT"],
    ["Menunggu promo akhir tahun", "TIMING_PROMO"],
    ["Material bangunan terlihat murah", "PRODUCT_QUALITY"],
    ["Reputasi developer belum dikenal", "TRUST_COMPARISON"],
    ["Masih ada pilihan lain", "TRUST_COMPARISON"],
  ])("%s -> %s", (text, category) => {
    expect(classifyObjection(text)).toBe(category);
  });

  it("uses first-rule-wins ordering (price before financing)", () => {
    expect(classifyObjection("Harga dan DP terlalu tinggi")).toBe("PRICE_VALUE");
  });

  it("matches at word start only and falls back to Lainnya", () => {
    expect(classifyObjection("Foto kurang menarik")).toBe("OTHER");
    expect(classifyObjection("adpxyz")).toBe("OTHER");
    expect(classifyObjection("")).toBe("OTHER");
  });
});

describe("mapObjectionRows", () => {
  const data = mapObjectionRows(RESULT);

  it("groups by normalized text with denominator = personas that succeeded", () => {
    expect(data.personasSimulated).toBe(3);
    expect(data.totalObjections).toBe(5);
    expect(data.rows).toHaveLength(3);
    const price = data.rows.find((r) => r.key === "harga terlalu tinggi");
    expect(price?.personaCount).toBe(3);
    expect(price?.agreementPct).toBe(100);
    expect(price?.frequencyTone).toBe("critical");
    expect(price?.personas.map((p) => p.text)).toEqual([
      "Harga terlalu tinggi",
      "harga terlalu tinggi.",
      "Harga terlalu tinggi",
    ]);
  });

  it("ranks by severity first, then agreement", () => {
    expect(data.rows.map((r) => [r.rank, r.objection])).toEqual([
      [1, "Sertifikat belum jelas"],
      [2, "Harga terlalu tinggi"],
      [3, "Cicilan KPR tidak disebut"],
    ]);
  });

  it("never invents impact, resolution or recommendation", () => {
    for (const row of data.rows) {
      expect(row.impact).toBeUndefined();
      expect(row.recommendation).toBeUndefined();
      expect(row.resolution).toBe("NOT_ASSESSED");
      expect(row.source).toBe("SIMULATED");
    }
  });

  it("rounds agreement % and colours by threshold", () => {
    const legal = data.rows.find((r) => r.category === "LEGAL_SECURITY");
    expect(legal?.agreementPct).toBe(33);
    expect(legal?.frequencyTone).toBe("info");
    expect(frequencyTone(80)).toBe("critical");
    expect(frequencyTone(50)).toBe("warning");
    expect(frequencyTone(49)).toBe("info");
  });
});

describe("mapObjectionFilters + filterObjectionRows", () => {
  const { rows } = mapObjectionRows(RESULT);

  it("shows only Semua + real severity tabs (no resolution tabs while nothing is assessed)", () => {
    const opts = mapObjectionFilters(rows);
    expect(opts.tabs.map((t) => `${t.label} (${String(t.count)})`)).toEqual([
      "Semua (3)",
      "Tinggi (1)",
      "Sedang (1)",
      "Rendah (1)",
    ]);
    expect(opts.resolutionNotAssessed).toBe(true);
    expect(opts.personas.map((p) => p.label).sort()).toEqual([
      "Investor",
      "Price Sensitive",
      "Skeptical Buyer",
    ]);
  });

  it("lights up resolution tabs once real statuses exist", () => {
    const withStatus = rows.map((r, i) =>
      i === 0 ? { ...r, resolution: "UNRESOLVED" as const } : r,
    );
    const opts = mapObjectionFilters(withStatus);
    expect(opts.tabs.map((t) => t.id)).toContain("RES_UNRESOLVED");
    expect(opts.resolutionNotAssessed).toBe(false);
  });

  it("filters by search, category, severity, persona and tab; sorts by agreement/category", () => {
    const f = (patch: Partial<typeof DEFAULT_OBJECTION_FILTERS>): string[] =>
      filterObjectionRows(rows, { ...DEFAULT_OBJECTION_FILTERS, ...patch }).map((r) => r.objection);
    expect(f({ search: "kpr" })).toEqual(["Cicilan KPR tidak disebut"]);
    expect(f({ category: "PRICE_VALUE" })).toEqual(["Harga terlalu tinggi"]);
    expect(f({ severity: "HIGH" })).toEqual(["Sertifikat belum jelas"]);
    expect(f({ persona: "INVESTOR" })).toEqual(["Harga terlalu tinggi"]);
    expect(f({ tab: "SEV_LOW" })).toEqual(["Cicilan KPR tidak disebut"]);
    expect(f({ sort: "AGREEMENT" })[0]).toBe("Harga terlalu tinggi");
    expect(f({ sort: "CATEGORY" })).toEqual([
      "Harga terlalu tinggi",
      "Sertifikat belum jelas",
      "Cicilan KPR tidak disebut",
    ]);
  });
});

describe("mapObjectionDetail", () => {
  const { rows } = mapObjectionRows(RESULT);
  it("links fact-check findings only on exact normalized match", () => {
    const legal = rows.find((r) => r.category === "LEGAL_SECURITY");
    const price = rows.find((r) => r.category === "PRICE_VALUE");
    if (legal === undefined || price === undefined) throw new Error("fixture");
    expect(mapObjectionDetail(legal, RESULT).relatedFindings).toHaveLength(1);
    expect(mapObjectionDetail(price, RESULT).relatedFindings).toHaveLength(0);
    expect(mapObjectionDetail(price, RESULT).needsKnowledge).toBe(false);
    expect(mapObjectionDetail(price, RESULT).agreementLabel).toBe("3/3 persona simulasi (100%)");
    const na = {
      ...RESULT,
      factCheck: { status: "NOT_APPLICABLE" as const, note: "n/a", findings: [] },
    };
    expect(mapObjectionDetail(price, na).needsKnowledge).toBe(true);
    expect(mapObjectionDetail(price, na).liveData).toBe("NOT_CONNECTED");
  });

  it("uses the short goal label", () => {
    expect(goalShortLabel("CPQL")).toBe("CPQL");
    expect(goalShortLabel("HOT_LEAD_RATE")).toBe("Hot Lead Rate");
  });
});

describe("objectionsToCsv", () => {
  it("escapes commas, quotes and newlines", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("writes header + one row per objection with empty live frequency/impact and NOT_ASSESSED resolution", () => {
    const { rows } = mapObjectionRows(RESULT);
    const tricky = [{ ...rows[0]!, objection: 'Harga "mahal", ya' }];
    const csv = objectionsToCsv(tricky);
    const [header, line] = csv.split("\r\n");
    expect(header).toBe(
      "objection,category,personas,simulation_agreement,live_frequency,severity,impact,resolution,recommendation,source",
    );
    expect(line).toBe(
      '"Harga ""mahal"", ya",Legal / Keamanan,Skeptical Buyer,1/3 (33%),,HIGH,,NOT_ASSESSED,,SIMULATION',
    );
    expect(objectionsCsvFilename("run-1")).toBe("stress-test-run-1-objections.csv");
  });
});
