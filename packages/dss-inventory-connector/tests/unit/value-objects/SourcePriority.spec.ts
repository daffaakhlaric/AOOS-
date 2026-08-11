import { describe, expect, it } from "vitest";

import {
  SourcePriority,
  sourcePriorityFor,
} from "../../../src/domain/value-objects/SourcePriority.js";
import { SourceSystem } from "../../../src/domain/value-objects/SourceSystem.js";

describe("SourcePriority", () => {
  it("orders API=3 > DMS=2 > SHEETS=1 > MOCK=0", () => {
    expect(SourcePriority.API).toBe(3);
    expect(SourcePriority.DMS).toBe(2);
    expect(SourcePriority.SHEETS).toBe(1);
    expect(SourcePriority.MOCK).toBe(0);
    expect(SourcePriority.API).toBeGreaterThan(SourcePriority.DMS);
    expect(SourcePriority.DMS).toBeGreaterThan(SourcePriority.SHEETS);
    expect(SourcePriority.SHEETS).toBeGreaterThan(SourcePriority.MOCK);
  });
});

describe("sourcePriorityFor", () => {
  it("maps each SourceSystem to its fixed priority", () => {
    expect(sourcePriorityFor(SourceSystem.API)).toBe(SourcePriority.API);
    expect(sourcePriorityFor(SourceSystem.DMS)).toBe(SourcePriority.DMS);
    expect(sourcePriorityFor(SourceSystem.GOOGLE_SHEETS)).toBe(SourcePriority.SHEETS);
    expect(sourcePriorityFor(SourceSystem.MOCK)).toBe(SourcePriority.MOCK);
  });
});
