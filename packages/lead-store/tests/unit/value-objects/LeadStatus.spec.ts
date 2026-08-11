import { describe, expect, it } from "vitest";

import {
  classifyTemperature,
  isPreAssignmentStatus,
  isTemperatureStatus,
  LeadStatus,
  parseLeadStatus,
} from "../../../src/domain/value-objects/LeadStatus.js";
import { unwrapErr } from "../../helpers/result.js";

describe("classifyTemperature", () => {
  it("score=64 classifies as WARM (pinned boundary)", () => {
    expect(classifyTemperature(64)).toBe(LeadStatus.WARM);
  });

  it("score=65 classifies as HOT (pinned boundary)", () => {
    expect(classifyTemperature(65)).toBe(LeadStatus.HOT);
  });

  it("score=0 classifies as COLD", () => {
    expect(classifyTemperature(0)).toBe(LeadStatus.COLD);
  });

  it("score=30 classifies as COLD (below warm threshold)", () => {
    expect(classifyTemperature(30)).toBe(LeadStatus.COLD);
  });

  it("score=31 classifies as WARM (warm threshold)", () => {
    expect(classifyTemperature(31)).toBe(LeadStatus.WARM);
  });

  it("score=100 classifies as HOT", () => {
    expect(classifyTemperature(100)).toBe(LeadStatus.HOT);
  });

  it("accepts custom thresholds", () => {
    expect(classifyTemperature(50, 10, 60)).toBe(LeadStatus.WARM);
    expect(classifyTemperature(60, 10, 60)).toBe(LeadStatus.HOT);
  });

  it("accepts a custom warmThreshold with the default hotThreshold", () => {
    expect(classifyTemperature(20, 15)).toBe(LeadStatus.WARM);
  });
});

describe("isPreAssignmentStatus", () => {
  it("is true for NEW, COLD, WARM, HOT", () => {
    expect(isPreAssignmentStatus(LeadStatus.NEW)).toBe(true);
    expect(isPreAssignmentStatus(LeadStatus.COLD)).toBe(true);
    expect(isPreAssignmentStatus(LeadStatus.WARM)).toBe(true);
    expect(isPreAssignmentStatus(LeadStatus.HOT)).toBe(true);
  });

  it("is false for ASSIGNED and CLOSED", () => {
    expect(isPreAssignmentStatus(LeadStatus.ASSIGNED)).toBe(false);
    expect(isPreAssignmentStatus(LeadStatus.CLOSED)).toBe(false);
  });
});

describe("isTemperatureStatus", () => {
  it("is true for COLD, WARM, HOT", () => {
    expect(isTemperatureStatus(LeadStatus.COLD)).toBe(true);
    expect(isTemperatureStatus(LeadStatus.WARM)).toBe(true);
    expect(isTemperatureStatus(LeadStatus.HOT)).toBe(true);
  });

  it("is false for NEW, ASSIGNED, CLOSED", () => {
    expect(isTemperatureStatus(LeadStatus.NEW)).toBe(false);
    expect(isTemperatureStatus(LeadStatus.ASSIGNED)).toBe(false);
    expect(isTemperatureStatus(LeadStatus.CLOSED)).toBe(false);
  });
});

describe("parseLeadStatus", () => {
  it("parses a valid uppercase status", () => {
    const result = parseLeadStatus("HOT");
    expect(result.ok && result.value).toBe(LeadStatus.HOT);
  });

  it("is case-insensitive", () => {
    const result = parseLeadStatus("hot");
    expect(result.ok && result.value).toBe(LeadStatus.HOT);
  });

  it("trims whitespace", () => {
    const result = parseLeadStatus("  hot  ");
    expect(result.ok && result.value).toBe(LeadStatus.HOT);
  });

  it("rejects an unknown status", () => {
    const error = unwrapErr(parseLeadStatus("FROZEN"));
    expect(error.message).toContain("FROZEN");
  });

  it("rejects a non-string input", () => {
    const error = unwrapErr(parseLeadStatus(42 as unknown as string));
    expect(error.message).toContain("status");
  });
});
