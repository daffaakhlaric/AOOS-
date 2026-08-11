import { describe, expect, it } from "vitest";

import { TargetLeads } from "../../../../src/domain/value-objects/TargetLeads.js";
import { unwrap } from "../../../helpers/result.js";

describe("TargetLeads", () => {
  it("creates a valid positive integer", () => {
    expect(unwrap(TargetLeads.create(50)).toNumber()).toBe(50);
  });

  it("rejects zero", () => {
    expect(TargetLeads.create(0).ok).toBe(false);
  });

  it("rejects a negative number", () => {
    expect(TargetLeads.create(-5).ok).toBe(false);
  });

  it("rejects a non-integer", () => {
    expect(TargetLeads.create(5.5).ok).toBe(false);
  });

  it("rejects NaN", () => {
    expect(TargetLeads.create(NaN).ok).toBe(false);
  });

  it("rejects Infinity", () => {
    expect(TargetLeads.create(Infinity).ok).toBe(false);
  });

  it("rejects a non-number", () => {
    expect(TargetLeads.create("50" as unknown as number).ok).toBe(false);
  });

  it("equals compares values", () => {
    const a = unwrap(TargetLeads.create(50));
    const b = unwrap(TargetLeads.create(50));
    const c = unwrap(TargetLeads.create(60));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
