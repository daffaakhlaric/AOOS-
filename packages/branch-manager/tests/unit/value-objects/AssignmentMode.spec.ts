import { describe, expect, it } from "vitest";

import {
  AssignmentMode,
  parseAssignmentMode,
} from "../../../src/domain/value-objects/AssignmentMode.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("AssignmentMode", () => {
  it("has exactly SMART_ASSIGN, ROUND_ROBIN, MANUAL", () => {
    expect(Object.values(AssignmentMode).sort()).toEqual(["MANUAL", "ROUND_ROBIN", "SMART_ASSIGN"]);
  });

  describe("parseAssignmentMode", () => {
    it("parses 'SMART_ASSIGN'", () => {
      expect(unwrap(parseAssignmentMode("SMART_ASSIGN"))).toBe(AssignmentMode.SMART_ASSIGN);
    });
    it("parses lowercase 'round_robin' case-insensitively", () => {
      expect(unwrap(parseAssignmentMode("round_robin"))).toBe(AssignmentMode.ROUND_ROBIN);
    });
    it("trims whitespace", () => {
      expect(unwrap(parseAssignmentMode("  MANUAL  "))).toBe(AssignmentMode.MANUAL);
    });
    it("rejects an unknown string", () => {
      expect(unwrapErr(parseAssignmentMode("AUTO")).message).toContain("mode must be one of");
    });
    it("rejects a non-string", () => {
      expect(unwrapErr(parseAssignmentMode(1 as unknown as string)).message).toContain(
        "must be a string",
      );
    });
  });
});
