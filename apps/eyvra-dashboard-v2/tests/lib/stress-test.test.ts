import { describe, expect, it } from "vitest";
import { composeKaiBrief, type StressTestEvaluatedResultDto } from "@/lib/stress-test";

const BASE_RESULT: StressTestEvaluatedResultDto = {
  kind: "COMPLETED",
  personaCritiques: [
    {
      personaId: "PRICE_SENSITIVE",
      personaLabel: "Price Sensitive",
      ok: true,
      critique: {
        simulated: true,
        attracts: ["Lokasi strategis"],
        confusions: [],
        objections: [
          { objection: "Harga tidak sesuai budget", severity: "HIGH" },
          { objection: "DP kurang jelas", severity: "LOW" },
        ],
        intentDrivers: ["Diskon DP"],
        narrativeReaction: "Lumayan menarik tapi masih mikir soal harga.",
      },
    },
    {
      personaId: "SKEPTICAL_BUYER",
      personaLabel: "Skeptical Buyer",
      ok: true,
      critique: {
        simulated: true,
        attracts: ["Lokasi strategis"],
        confusions: [],
        objections: [{ objection: "Legalitas belum jelas", severity: "MEDIUM" }],
        intentDrivers: [],
        narrativeReaction: "Masih ragu.",
      },
    },
  ],
  copyEvaluation: {
    ok: true,
    hookClarity: {
      status: "STRONG",
      reasoning: "Judul menonjolkan lokasi strategis dengan jelas.",
    },
    offerStrength: { status: "ADEQUATE", reasoning: "Penawaran cukup tapi tidak spesifik." },
    ctaSpecificity: { status: "WEAK", reasoning: "Tidak ada CTA yang jelas mengarahkan aksi." },
    internalConsistency: { status: "STRONG", reasoning: "Klaim konsisten satu sama lain." },
    summary: "Copy cukup kuat di hook, lemah di CTA.",
  },
  factCheck: {
    status: "CHECKED",
    note: "Diverifikasi terhadap Listing Knowledge.",
    findings: [
      {
        claim: "Bebas banjir sepanjang tahun",
        status: "CONFLICTING_CLAIM",
        reasoning: "Dokumen listing menyebut area rawan banjir musiman.",
      },
    ],
  },
  dimensionScores: [
    { dimension: "HOOK", score: 90 },
    { dimension: "OFFER", score: 65 },
    { dimension: "CTA", score: 35 },
    { dimension: "OBJECTION_HANDLING", score: 55 },
  ],
  overallScore: 61,
  scoreBucket: "NEEDS_REVISION",
  confidence: 100,
  primaryRecommendation:
    'Prioritas utama: klaim "Bebas banjir sepanjang tahun" pada creative ini BERTENTANGAN dengan Listing Knowledge (Dokumen listing menyebut area rawan banjir musiman.) — perbaiki klaim ini sebelum creative ini dijalankan.',
  evaluatorsAttempted: 3,
  evaluatorsSucceeded: 3,
  gaps: [],
};

describe("composeKaiBrief", () => {
  it("cites the real lowest-scoring dimension's real reasoning, never generic text", () => {
    const brief = composeKaiBrief(BASE_RESULT);
    expect(brief).toContain("Tidak ada CTA yang jelas mengarahkan aksi.");
    expect(brief).not.toMatch(/improve the ad/i);
  });

  it("cites the real highest-severity objection and which persona raised it", () => {
    const brief = composeKaiBrief(BASE_RESULT);
    expect(brief).toContain("Harga tidak sesuai budget");
    expect(brief).toContain("Price Sensitive");
    expect(brief).not.toContain("DP kurang jelas");
  });

  it("cites the real CONFLICTING_CLAIM fact-check finding under Hindari", () => {
    const brief = composeKaiBrief(BASE_RESULT);
    expect(brief).toContain("Bebas banjir sepanjang tahun");
    expect(brief).toContain("Hindari");
  });

  it("includes the real primaryRecommendation", () => {
    const brief = composeKaiBrief(BASE_RESULT);
    expect(brief).toContain("BERTENTANGAN dengan Listing Knowledge");
  });

  it("includes a real Pertahankan section only when strong dims/attracts genuinely exist", () => {
    const brief = composeKaiBrief(BASE_RESULT);
    expect(brief).toContain("Pertahankan");
    expect(brief).toContain("Judul menonjolkan lokasi strategis dengan jelas.");
  });

  it("omits the Hindari section entirely when no real conflicting/unsupported claim exists — never a placeholder bullet", () => {
    const brief = composeKaiBrief({
      ...BASE_RESULT,
      factCheck: { status: "NOT_APPLICABLE", note: "Tidak dapat diverifikasi.", findings: [] },
    });
    expect(brief).not.toContain("Hindari");
  });

  it("stays within the 2000-character limit the aaos-api brief endpoints enforce", () => {
    const longResult: StressTestEvaluatedResultDto = {
      ...BASE_RESULT,
      primaryRecommendation: "x".repeat(3000),
    };
    expect(composeKaiBrief(longResult).length).toBeLessThanOrEqual(2000);
  });
});
