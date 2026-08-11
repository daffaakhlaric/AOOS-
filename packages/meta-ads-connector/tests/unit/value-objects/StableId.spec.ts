import { describe, expect, it } from "vitest";

import { StableId } from "../../../src/domain/value-objects/StableId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("StableId", () => {
  it.each([
    ["A", 1, "#A001"],
    ["B", 14, "#B014"],
    ["C", 999, "#C999"],
  ] as const)("formats prefix %s sequence %d as %s", (prefix, sequence, expected) => {
    expect(unwrap(StableId.create(prefix, sequence)).toString()).toBe(expected);
  });

  it("rejects an invalid prefix", () => {
    expect(unwrapErr(StableId.create("D" as never, 1)).message).toMatch(/A, B, C/);
  });

  it("rejects a zero sequence", () => {
    expect(StableId.create("A", 0).ok).toBe(false);
  });

  it("rejects a negative sequence", () => {
    expect(StableId.create("A", -1).ok).toBe(false);
  });

  it("rejects a non-integer sequence", () => {
    expect(StableId.create("A", 1.5).ok).toBe(false);
  });

  it("rejects a sequence above 999", () => {
    expect(StableId.create("A", 1000).ok).toBe(false);
  });

  it("accepts the boundary sequence 999", () => {
    expect(StableId.create("A", 999).ok).toBe(true);
  });

  it("equals compares prefix and sequence", () => {
    const a = unwrap(StableId.create("A", 1));
    const b = unwrap(StableId.create("A", 1));
    const c = unwrap(StableId.create("B", 1));
    const d = unwrap(StableId.create("A", 2));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    expect(a.equals(d)).toBe(false);
  });
});
