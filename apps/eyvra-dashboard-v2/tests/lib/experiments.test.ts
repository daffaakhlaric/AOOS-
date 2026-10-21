import { expect, it } from "vitest";
import {
  experimentOverviewCounts,
  experimentResultLabel,
  experimentResultsSummary,
  experimentLearnings,
  presentExperimentStatus,
  untestedAngles,
} from "@/lib/experiments";
import type { CampaignExperiment } from "@/lib/campaign-workspace";

function test(overrides: Partial<CampaignExperiment>): CampaignExperiment {
  return {
    id: "t",
    name: "Test",
    campaignId: "c",
    status: "RUNNING",
    thresholdSpend: 100,
    thresholdDays: 3,
    minMarginPct: 20,
    createdAt: "2026-09-01T00:00:00Z",
    variants: [],
    ...overrides,
  };
}

it("maps real status + winnerVariantId presence to the honest presentation status", () => {
  expect(presentExperimentStatus(test({ status: "RUNNING" }))).toBe("Running");
  expect(presentExperimentStatus(test({ status: "DRAFT" }))).toBe("Draft");
  expect(presentExperimentStatus(test({ status: "PAUSED" }))).toBe("Stopped");
  expect(presentExperimentStatus(test({ status: "FAILED" }))).toBe("Stopped");
  // COMPLETE + winnerVariantId -> real "Winner selected", never re-derived.
  expect(presentExperimentStatus(test({ status: "COMPLETE", winnerVariantId: "v1" }))).toBe(
    "Winner selected",
  );
  // COMPLETE without winnerVariantId -> real, meaningful "Inconclusive" (decideWinner returned
  // undefined server-side), never presented as a generic "Complete".
  expect(presentExperimentStatus(test({ status: "COMPLETE" }))).toBe("Inconclusive");
});

it("computes overview counts from real predicates only", () => {
  const tests = [
    test({ id: "a", status: "RUNNING" }),
    test({ id: "b", status: "COMPLETE", winnerVariantId: "v" }),
    test({ id: "c", status: "COMPLETE" }),
    test({ id: "d", status: "PAUSED" }),
    test({ id: "e", status: "FAILED" }),
    test({ id: "f", status: "DRAFT" }),
  ];
  expect(experimentOverviewCounts(tests)).toEqual({
    total: 6,
    running: 1,
    winner: 1,
    inconclusive: 1,
    stopped: 2,
    draft: 1,
  });
});

it("only rphLead-derived results are real; result label never fabricates a metric", () => {
  const winnerTest = test({
    status: "COMPLETE",
    winnerVariantId: "v1",
    improvementPct: 18,
    variants: [{ id: "v1" } as CampaignExperiment["variants"][number]],
  });
  expect(experimentResultLabel(winnerTest)).toBe("Winner 18% lebih efisien (Rp/lead)");
  expect(experimentResultsSummary([winnerTest])).toEqual({ count: 1, averageImprovementPct: 18 });
  const inconclusiveTest = test({ status: "COMPLETE" });
  expect(experimentResultLabel(inconclusiveTest)).toBe("Inconclusive");
  const runningTest = test({ status: "RUNNING" });
  expect(experimentResultLabel(runningTest)).toBe("Belum ada hasil");
  // No completed-with-winner test at all -> honest empty summary, no fabricated average.
  expect(experimentResultsSummary([inconclusiveTest, runningTest])).toEqual({ count: 0 });
});

it("gates Learning & Insights on real completed-with-winner tests only", () => {
  expect(experimentLearnings([test({ status: "RUNNING" })])).toEqual([]);
  const withWinner = test({
    name: "Angle test",
    status: "COMPLETE",
    winnerVariantId: "v1",
    improvementPct: 25,
    variants: [
      { id: "v1", angle: "INVESTASI" } as CampaignExperiment["variants"][number],
      { id: "v2", angle: "DP_RINGAN" } as CampaignExperiment["variants"][number],
    ],
  });
  const learnings = experimentLearnings([withWinner]);
  expect(learnings).toHaveLength(1);
  expect(learnings[0]).toContain("Investasi");
  expect(learnings[0]).toContain("Dp ringan");
  expect(learnings[0]).toContain("25%");
});

it("computes untested angles from real gallery angles minus real tested variant angles", () => {
  const tests = [
    test({
      variants: [{ id: "v1", angle: "INVESTASI" } as CampaignExperiment["variants"][number]],
    }),
  ];
  expect(untestedAngles(["INVESTASI", "DP_RINGAN", "SYARIAH"], tests)).toEqual([
    "DP_RINGAN",
    "SYARIAH",
  ]);
});
