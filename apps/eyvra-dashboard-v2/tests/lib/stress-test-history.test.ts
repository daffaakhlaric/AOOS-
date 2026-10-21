import { describe, expect, it } from "vitest";
import type { StressTestEvaluatedResultDto, StressTestRunDto } from "@/lib/stress-test";
import {
  CONFIDENCE_THRESHOLDS,
  DEFAULT_HISTORY_FILTERS,
  confidenceLevel,
  formatRelativeTime,
  initialsOf,
  mapSimulationHistory,
  mapSimulationRunListItem,
  type RunListContext,
  type SimulationRunListItem,
} from "@/lib/stress-test-history";

const NOW = Date.parse("2026-09-28T12:00:00.000Z");
const CTX: RunListContext = { listings: new Map(), personaLabels: new Map(), nowMs: NOW };

const RESULT: StressTestEvaluatedResultDto = {
  kind: "COMPLETED",
  personaCritiques: [
    {
      personaId: "PRICE_SENSITIVE",
      personaLabel: "Price Sensitive",
      ok: true,
      critique: {
        simulated: true,
        attracts: [],
        confusions: [],
        objections: [
          { objection: "Harga tinggi", severity: "HIGH" },
          { objection: "DP besar", severity: "LOW" },
        ],
        intentDrivers: [],
        narrativeReaction: "x",
      },
    },
  ],
  copyEvaluation: { ok: false },
  factCheck: { status: "NOT_APPLICABLE", note: "n/a", findings: [] },
  dimensionScores: [{ dimension: "OBJECTION_HANDLING", score: 70 }],
  overallScore: 70,
  scoreBucket: "MINOR_REVISION",
  confidence: 60,
  primaryRecommendation: "Perjelas harga.",
  evaluatorsAttempted: 2,
  evaluatorsSucceeded: 1,
  gaps: [],
};

function run(overrides: Partial<StressTestRunDto> = {}): StressTestRunDto {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    name: "Run A",
    sourceType: "LISTING",
    creativeIds: [],
    mode: "STANDARD",
    primaryGoal: "CREATIVE_QUALITY",
    personaIds: ["PRICE_SENSITIVE"],
    objectionSources: [],
    status: "COMPLETED",
    result: RESULT,
    createdAt: "2026-09-28T09:00:00.000Z",
    ...overrides,
  };
}

describe("mapSimulationRunListItem", () => {
  it("reads readiness only from the real result bucket — a COMPLETED run with no result has no readiness", () => {
    const item = mapSimulationRunListItem(run({ result: null }), CTX);
    expect(item.status).toBe("COMPLETED");
    expect(item.bucket).toBeUndefined();
    expect(item.bucketLabel).toBeUndefined();
    const evaluated = mapSimulationRunListItem(run(), CTX);
    expect(evaluated.bucketLabel).toBe("Revisi Minor");
  });

  it("keeps score undefined (never 0) when overallScore is null", () => {
    const item = mapSimulationRunListItem(
      run({ result: { ...RESULT, overallScore: null, scoreBucket: null } }),
      CTX,
    );
    expect(item.score).toBeUndefined();
    expect(item.bucket).toBeUndefined();
    expect(mapSimulationRunListItem(run(), CTX).score).toBe(70);
  });

  it("maps a legacy WAITING_FOR_ENGINE run to gaps everywhere", () => {
    const item = mapSimulationRunListItem(
      run({
        status: "WAITING_FOR_ENGINE",
        result: { kind: "WAITING_FOR_ENGINE", reason: "x", objectionSourceAvailability: [] },
      }),
      CTX,
    );
    expect(item.hasEvaluatedResult).toBe(false);
    expect(item.score).toBeUndefined();
    expect(item.confidence).toBeUndefined();
    expect(item.topIssue).toBeUndefined();
    expect(item.objections).toBeUndefined();
  });

  it("uses the real primaryRecommendation as top issue and real objection counts", () => {
    const item = mapSimulationRunListItem(run(), CTX);
    expect(item.topIssue).toBe("Perjelas harga.");
    expect(item.objections).toEqual({ total: 2, unique: 2 });
  });

  it("falls back to the first real priority item when primaryRecommendation is empty", () => {
    const item = mapSimulationRunListItem(
      run({ result: { ...RESULT, primaryRecommendation: " " } }),
      CTX,
    );
    expect(item.topIssue).toBe('Jawab keberatan: "Harga tinggi"');
  });

  it("never exposes a result for a FAILED run and reports the real failure reason only when persisted", () => {
    const failed = mapSimulationRunListItem(run({ status: "FAILED" }), CTX);
    expect(failed.hasEvaluatedResult).toBe(false);
    expect(failed.failureReason).toBeUndefined();
    expect(
      mapSimulationRunListItem(run({ status: "FAILED", failedReason: "boom" }), CTX).failureReason,
    ).toBe("boom");
  });

  it("resolves context + creative from a real listing; campaign runs stay unresolved", () => {
    const listings = new Map([
      [
        "l1",
        {
          id: "l1",
          title: "Rumah A",
          mainPhotoUrl: "m.jpg",
          photos: [{ id: "p1", url: "p1.jpg", isMain: false }],
        },
      ],
    ]);
    const item = mapSimulationRunListItem(run({ listingId: "l1", creativeIds: ["p1", "p9"] }), {
      ...CTX,
      listings,
    });
    expect(item.contextTitle).toBe("Rumah A");
    expect(item.contextThumbnailUrl).toBe("m.jpg");
    expect(item.creative).toEqual({
      kind: "RESOLVED",
      resolved: 1,
      selected: 2,
      thumbnailUrl: "p1.jpg",
    });
    const campaign = mapSimulationRunListItem(
      run({ sourceType: "CAMPAIGN", campaignId: "c1", creativeIds: ["x"] }),
      CTX,
    );
    expect(campaign.contextTitle).toBeUndefined();
    expect(campaign.sourceTypeLabel).toBe("Campaign");
    expect(campaign.creative).toEqual({ kind: "UNRESOLVED", selected: 1 });
    expect(mapSimulationRunListItem(run(), CTX).creative).toEqual({ kind: "NONE" });
  });

  it("marks context as loading until the listing fetch settles", () => {
    expect(mapSimulationRunListItem(run({ listingId: "l2" }), CTX).contextLoading).toBe(true);
    const settled = { ...CTX, listings: new Map([["l2", null]]) };
    const item = mapSimulationRunListItem(run({ listingId: "l2" }), settled);
    expect(item.contextLoading).toBe(false);
    expect(item.contextTitle).toBeUndefined();
  });

  it("formats created date and relative time", () => {
    const item = mapSimulationRunListItem(run(), CTX);
    expect(item.createdLabel).toMatch(/^\d{1,2} Sep 2026 · \d{2}:\d{2}$/);
    expect(item.relativeLabel).toBe("3 jam lalu");
    expect(formatRelativeTime("2026-09-28T11:59:30.000Z", NOW)).toBe("baru saja");
    expect(formatRelativeTime("2026-09-25T12:00:00.000Z", NOW)).toBe("3 hari lalu");
  });

  it("builds persona initials from result labels, else preset labels, else the id", () => {
    expect(initialsOf("Price Sensitive")).toBe("PS");
    expect(initialsOf("Investor")).toBe("IN");
    const item = mapSimulationRunListItem(
      run({ result: null, personaIds: ["PRICE_SENSITIVE", "INVESTOR"] }),
      {
        ...CTX,
        personaLabels: new Map([["INVESTOR", "Investor"]]),
      },
    );
    expect(item.personas.map((p) => p.label)).toEqual(["PRICE_SENSITIVE", "Investor"]);
  });
});

describe("confidenceLevel", () => {
  it("uses the documented thresholds (High >= 80, Medium >= 50, else Low)", () => {
    expect(CONFIDENCE_THRESHOLDS).toEqual({ HIGH: 80, MEDIUM: 50 });
    expect(confidenceLevel(100)).toBe("HIGH");
    expect(confidenceLevel(80)).toBe("HIGH");
    expect(confidenceLevel(79)).toBe("MEDIUM");
    expect(confidenceLevel(50)).toBe("MEDIUM");
    expect(confidenceLevel(49)).toBe("LOW");
    expect(confidenceLevel(0)).toBe("LOW");
  });
});

describe("mapSimulationHistory", () => {
  const items: SimulationRunListItem[] = [
    mapSimulationRunListItem(
      run({
        id: "a",
        name: "Alpha",
        createdAt: "2026-09-20T10:00:00.000Z",
        result: { ...RESULT, overallScore: 40, scoreBucket: "MAJOR_ISSUES" },
      }),
      CTX,
    ),
    mapSimulationRunListItem(
      run({
        id: "b",
        name: "Beta",
        mode: "DEEP",
        createdAt: "2026-09-25T10:00:00.000Z",
        result: { ...RESULT, overallScore: 90, scoreBucket: "READY_TO_TEST" },
      }),
      CTX,
    ),
    mapSimulationRunListItem(
      run({
        id: "c",
        name: "Gamma",
        status: "WAITING_FOR_ENGINE",
        result: null,
        createdAt: "2026-09-27T10:00:00.000Z",
      }),
      CTX,
    ),
    mapSimulationRunListItem(
      run({
        id: "d",
        name: "Delta",
        createdAt: "2026-09-22T10:00:00.000Z",
        result: { ...RESULT, overallScore: 60, scoreBucket: "NEEDS_REVISION" },
      }),
      CTX,
    ),
  ];
  const ids = (f: Partial<typeof DEFAULT_HISTORY_FILTERS>): string[] =>
    mapSimulationHistory(items, { ...DEFAULT_HISTORY_FILTERS, ...f }).rows.map((r) => r.id);

  it("sorts newest/oldest and by score with missing scores last in both directions", () => {
    expect(ids({})).toEqual(["c", "b", "d", "a"]);
    expect(ids({ sort: "OLDEST" })).toEqual(["a", "d", "b", "c"]);
    expect(ids({ sort: "SCORE_DESC" })).toEqual(["b", "d", "a", "c"]);
    expect(ids({ sort: "SCORE_ASC" })).toEqual(["a", "d", "b", "c"]);
  });

  it("filters by search, mode, status, readiness (incl. none) and chips", () => {
    expect(ids({ search: "alp" })).toEqual(["a"]);
    expect(ids({ mode: "DEEP" })).toEqual(["b"]);
    expect(ids({ status: "WAITING_FOR_ENGINE" })).toEqual(["c"]);
    expect(ids({ readiness: "NONE" })).toEqual(["c"]);
    expect(ids({ readiness: "READY_TO_TEST" })).toEqual(["b"]);
    expect(ids({ chip: "NEEDS_REVISION" })).toEqual(["d", "a"]);
    expect(ids({ chip: "READY_TO_TEST" })).toEqual(["b"]);
    expect(ids({ chip: "DEEP" })).toEqual(["b"]);
    expect(ids({ contextType: "CAMPAIGN" })).toEqual([]);
  });

  it("filters by inclusive local date range", () => {
    expect(ids({ dateFrom: "2026-09-22", dateTo: "2026-09-25" })).toEqual(["b", "d"]);
  });

  it("paginates and clamps the page", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      mapSimulationRunListItem(
        run({ id: `r${String(i)}`, createdAt: new Date(NOW - i * 60_000).toISOString() }),
        CTX,
      ),
    );
    const p1 = mapSimulationHistory(many, { ...DEFAULT_HISTORY_FILTERS, pageSize: 25 });
    expect(p1.rows).toHaveLength(25);
    expect(p1.pageCount).toBe(3);
    const p3 = mapSimulationHistory(many, { ...DEFAULT_HISTORY_FILTERS, pageSize: 25, page: 3 });
    expect(p3.rows).toHaveLength(10);
    expect(
      mapSimulationHistory(many, { ...DEFAULT_HISTORY_FILTERS, pageSize: 50, page: 9 }).page,
    ).toBe(2);
    expect(
      mapSimulationHistory(many, { ...DEFAULT_HISTORY_FILTERS, pageSize: 100 }).rows,
    ).toHaveLength(60);
  });
});
