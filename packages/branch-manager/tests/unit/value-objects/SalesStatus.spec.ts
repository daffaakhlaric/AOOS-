import { describe, expect, it } from "vitest";

import { parseSalesStatus, SalesStatus } from "../../../src/domain/value-objects/SalesStatus.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("SalesStatus", () => {
  it("has exactly ON, BUSY, OFF", () => {
    expect(Object.values(SalesStatus).sort()).toEqual(["BUSY", "OFF", "ON"]);
  });

  describe("parseSalesStatus", () => {
    it("parses 'ON'", () => {
      expect(unwrap(parseSalesStatus("ON"))).toBe(SalesStatus.ON);
    });
    it("parses lowercase 'busy' case-insensitively", () => {
      expect(unwrap(parseSalesStatus("busy"))).toBe(SalesStatus.BUSY);
    });
    it("trims whitespace", () => {
      expect(unwrap(parseSalesStatus("  OFF  "))).toBe(SalesStatus.OFF);
    });
    it("rejects an unknown string", () => {
      expect(unwrapErr(parseSalesStatus("AWAY")).message).toContain("status must be one of");
    });
    it("rejects a non-string", () => {
      expect(unwrapErr(parseSalesStatus(42 as unknown as string)).message).toContain(
        "must be a string",
      );
    });
  });
});
