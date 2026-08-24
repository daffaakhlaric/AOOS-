import { BranchId } from "@aos/branch-manager";
import { ClosingBuilder, ClosingType, type Closing } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import { ClosingIntelService } from "../../../src/intelligence/ClosingIntelService.js";

function buildClosing(overrides: {
  unitModel?: string | undefined;
  branchId?: BranchId;
  closingType?: ClosingType;
}): Closing {
  const result = new ClosingBuilder()
    .withUnitModel(overrides.unitModel)
    .withBranchId(overrides.branchId ?? BranchId.BINTARO)
    .withClosingType(overrides.closingType ?? ClosingType.SPK)
    .build();
  if (!result.ok) {
    throw new Error(`fixture build failed: ${result.error.message}`);
  }
  return result.value;
}

describe("ClosingIntelService.getClosingSignals", () => {
  it("returns empty signals for no closings", () => {
    const signal = ClosingIntelService.getClosingSignals([]);
    expect(signal.totalEvents).toBe(0);
    expect(signal.topUnitModels).toEqual([]);
    expect(signal.byBranch).toEqual([]);
    expect(signal.slowUnitModels).toEqual([]);
  });

  it("groups by unitModel and computes SPK/cancelled counts + closingRate", () => {
    const closings = [
      buildClosing({ unitModel: "Xpander", closingType: ClosingType.SPK }),
      buildClosing({ unitModel: "Xpander", closingType: ClosingType.SPK }),
      buildClosing({ unitModel: "Xpander", closingType: ClosingType.CANCELLED }),
      buildClosing({ unitModel: "Avanza", closingType: ClosingType.TEST_DRIVE }),
    ];
    const signal = ClosingIntelService.getClosingSignals(closings);
    expect(signal.totalEvents).toBe(4);
    const xpander = signal.topUnitModels.find((u) => u.unitModel === "Xpander");
    expect(xpander).toEqual({
      unitModel: "Xpander",
      totalEvents: 3,
      spkCount: 2,
      cancelledCount: 1,
      closingRate: 2 / 3,
    });
    const avanza = signal.topUnitModels.find((u) => u.unitModel === "Avanza");
    expect(avanza).toEqual({
      unitModel: "Avanza",
      totalEvents: 1,
      spkCount: 0,
      cancelledCount: 0,
      closingRate: 0,
    });
  });

  it("ranks topUnitModels by SPK count descending", () => {
    const closings = [
      buildClosing({ unitModel: "Low", closingType: ClosingType.SPK }),
      buildClosing({ unitModel: "High", closingType: ClosingType.SPK }),
      buildClosing({ unitModel: "High", closingType: ClosingType.SPK }),
    ];
    const signal = ClosingIntelService.getClosingSignals(closings);
    expect(signal.topUnitModels.map((u) => u.unitModel)).toEqual(["High", "Low"]);
  });

  it("skips closings with no unitModel when building per-model signals", () => {
    const closings = [
      buildClosing({ unitModel: undefined, closingType: ClosingType.SPK }),
      buildClosing({ unitModel: "Xpander", closingType: ClosingType.SPK }),
    ];
    const signal = ClosingIntelService.getClosingSignals(closings);
    expect(signal.topUnitModels.map((u) => u.unitModel)).toEqual(["Xpander"]);
    expect(signal.totalEvents).toBe(2);
  });

  it("ranks slowUnitModels ascending by closingRate, only including models with >= minEventsForAvoid events", () => {
    const closings = [
      // "Rare" has only 1 event (0% closing) — excluded by the default minEventsForAvoid=3.
      buildClosing({ unitModel: "Rare", closingType: ClosingType.CANCELLED }),
      // "Slow" has 3 events, 1 SPK (33% closing).
      buildClosing({ unitModel: "Slow", closingType: ClosingType.SPK }),
      buildClosing({ unitModel: "Slow", closingType: ClosingType.CANCELLED }),
      buildClosing({ unitModel: "Slow", closingType: ClosingType.CANCELLED }),
      // "Fast" has 3 events, 3 SPK (100% closing).
      buildClosing({ unitModel: "Fast", closingType: ClosingType.SPK }),
      buildClosing({ unitModel: "Fast", closingType: ClosingType.SPK }),
      buildClosing({ unitModel: "Fast", closingType: ClosingType.SPK }),
    ];
    const signal = ClosingIntelService.getClosingSignals(closings);
    expect(signal.slowUnitModels.map((u) => u.unitModel)).toEqual(["Slow", "Fast"]);
  });

  it("groups by branch and ranks byBranch by SPK count descending", () => {
    const closings = [
      buildClosing({ branchId: BranchId.CINERE, closingType: ClosingType.SPK }),
      buildClosing({ branchId: BranchId.BINTARO, closingType: ClosingType.SPK }),
      buildClosing({ branchId: BranchId.BINTARO, closingType: ClosingType.SPK }),
      buildClosing({ branchId: BranchId.BINTARO, closingType: ClosingType.CANCELLED }),
    ];
    const signal = ClosingIntelService.getClosingSignals(closings);
    expect(signal.byBranch.map((b) => b.branchId)).toEqual([
      String(BranchId.BINTARO),
      String(BranchId.CINERE),
    ]);
    const bintaro = signal.byBranch.find((b) => b.branchId === String(BranchId.BINTARO));
    expect(bintaro).toEqual({
      branchId: String(BranchId.BINTARO),
      totalEvents: 3,
      spkCount: 2,
      closingRate: 2 / 3,
    });
  });
});
