import { describe, expect, it } from "vitest";

import { AssignmentId } from "../../../src/domain/value-objects/AssignmentId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("AssignmentId", () => {
  it("creates from a valid non-empty string", () => {
    expect(unwrap(AssignmentId.create("abc")).toString()).toBe("abc");
  });

  it("rejects an empty string", () => {
    expect(unwrapErr(AssignmentId.create("")).message).toContain("AssignmentId");
  });

  it("generate() produces unique ids", () => {
    const a = AssignmentId.generate();
    const b = AssignmentId.generate();
    expect(a.equals(b)).toBe(false);
  });

  it("equals compares by value", () => {
    const a = unwrap(AssignmentId.create("x"));
    const b = unwrap(AssignmentId.create("x"));
    const c = unwrap(AssignmentId.create("y"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
