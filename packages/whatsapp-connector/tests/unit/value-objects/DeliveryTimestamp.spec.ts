import { describe, expect, it } from "vitest";

import { DeliveryTimestamp } from "../../../src/domain/value-objects/DeliveryTimestamp.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("DeliveryTimestamp", () => {
  it("parses a Unix-seconds numeric string into a Date", () => {
    const ts = unwrap(DeliveryTimestamp.fromUnixSeconds("1700000000"));
    expect(ts.toDate().getTime()).toBe(1_700_000_000 * 1000);
  });

  it("rejects a non-numeric string", () => {
    const error = unwrapErr(DeliveryTimestamp.fromUnixSeconds("not-a-number"));
    expect(error).toBeDefined();
  });

  it("rejects an all-digit string so long it overflows to Infinity", () => {
    const error = unwrapErr(DeliveryTimestamp.fromUnixSeconds("9".repeat(400)));
    expect(error.message).toContain("overflowed");
  });

  it("rejects an empty string", () => {
    const error = unwrapErr(DeliveryTimestamp.fromUnixSeconds(""));
    expect(error).toBeDefined();
  });

  it("fromDate wraps a Date directly", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    const ts = DeliveryTimestamp.fromDate(date);
    expect(ts.toDate()).toEqual(date);
  });

  it("equals compares by timestamp value", () => {
    const a = unwrap(DeliveryTimestamp.fromUnixSeconds("1700000000"));
    const b = DeliveryTimestamp.fromDate(new Date(1_700_000_000 * 1000));
    const c = unwrap(DeliveryTimestamp.fromUnixSeconds("1700000001"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
