import { describe, expect, it } from "vitest";

import {
  classifyTemperature,
  LeadTemperature,
} from "../../../../src/domain/value-objects/LeadTemperature.js";

describe("classifyTemperature", () => {
  it("score=0 → COLD", () => {
    expect(classifyTemperature(0, 31, 65)).toBe(LeadTemperature.COLD);
  });

  it("score=30 → COLD (boundary)", () => {
    expect(classifyTemperature(30, 31, 65)).toBe(LeadTemperature.COLD);
  });

  it("score=31 → WARM (boundary)", () => {
    expect(classifyTemperature(31, 31, 65)).toBe(LeadTemperature.WARM);
  });

  it("score=64 → WARM (pinned boundary)", () => {
    expect(classifyTemperature(64, 31, 65)).toBe(LeadTemperature.WARM);
  });

  it("score=65 → HOT (pinned boundary)", () => {
    expect(classifyTemperature(65, 31, 65)).toBe(LeadTemperature.HOT);
  });

  it("score=100 → HOT", () => {
    expect(classifyTemperature(100, 31, 65)).toBe(LeadTemperature.HOT);
  });
});
