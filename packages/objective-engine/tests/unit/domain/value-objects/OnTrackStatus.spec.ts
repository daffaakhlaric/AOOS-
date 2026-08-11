import { describe, expect, it } from "vitest";

import {
  classifyOnTrackStatus,
  OnTrackStatus,
} from "../../../../src/domain/value-objects/OnTrackStatus.js";

const ON_TRACK_THRESHOLD = 0.85;
const AT_RISK_THRESHOLD = 0.6;

describe("classifyOnTrackStatus", () => {
  it("pinned business-correctness: ratio=0.84 -> AT_RISK", () => {
    expect(classifyOnTrackStatus(0.84, ON_TRACK_THRESHOLD, AT_RISK_THRESHOLD)).toBe(
      OnTrackStatus.AT_RISK,
    );
  });

  it("pinned business-correctness: ratio=0.85 -> ON_TRACK (boundary, inclusive)", () => {
    expect(classifyOnTrackStatus(0.85, ON_TRACK_THRESHOLD, AT_RISK_THRESHOLD)).toBe(
      OnTrackStatus.ON_TRACK,
    );
  });

  it("classifies a ratio well above the on-track threshold as ON_TRACK", () => {
    expect(classifyOnTrackStatus(1.5, ON_TRACK_THRESHOLD, AT_RISK_THRESHOLD)).toBe(
      OnTrackStatus.ON_TRACK,
    );
  });

  it("classifies ratio=0.60 as AT_RISK (boundary, inclusive)", () => {
    expect(classifyOnTrackStatus(0.6, ON_TRACK_THRESHOLD, AT_RISK_THRESHOLD)).toBe(
      OnTrackStatus.AT_RISK,
    );
  });

  it("classifies ratio=0.59 as OFF_TRACK", () => {
    expect(classifyOnTrackStatus(0.59, ON_TRACK_THRESHOLD, AT_RISK_THRESHOLD)).toBe(
      OnTrackStatus.OFF_TRACK,
    );
  });

  it("classifies ratio=0 as OFF_TRACK", () => {
    expect(classifyOnTrackStatus(0, ON_TRACK_THRESHOLD, AT_RISK_THRESHOLD)).toBe(
      OnTrackStatus.OFF_TRACK,
    );
  });

  it("respects custom thresholds", () => {
    expect(classifyOnTrackStatus(0.5, 0.5, 0.3)).toBe(OnTrackStatus.ON_TRACK);
    expect(classifyOnTrackStatus(0.4, 0.5, 0.3)).toBe(OnTrackStatus.AT_RISK);
    expect(classifyOnTrackStatus(0.2, 0.5, 0.3)).toBe(OnTrackStatus.OFF_TRACK);
  });
});
