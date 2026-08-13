import { describe, expect, it } from "vitest";

import { EventTime } from "../../../../src/domain/value-objects/EventTime.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("EventTime", () => {
  describe("fromDate", () => {
    it("converts a Date to Unix seconds (business correctness: exact pinned fixture)", () => {
      // 1723212180 == 2024-08-09T14:03:00.000Z, verified via Math.floor(date.getTime() / 1000).
      const eventTime = unwrap(EventTime.fromDate(new Date("2024-08-09T14:03:00.000Z")));
      expect(eventTime.value).toBe(1723212180);
    });

    it("floors sub-second precision (never rounds up)", () => {
      const eventTime = unwrap(EventTime.fromDate(new Date("2024-08-09T14:03:00.999Z")));
      expect(eventTime.value).toBe(1723212180);
    });

    it("rejects an invalid Date", () => {
      const error = unwrapErr(EventTime.fromDate(new Date("not-a-date")));
      expect(error.message).toContain("EventTime.fromDate requires a valid Date");
    });
  });

  describe("fromUnixSeconds", () => {
    it("accepts a non-negative integer", () => {
      const eventTime = unwrap(EventTime.fromUnixSeconds(1723212180));
      expect(eventTime.value).toBe(1723212180);
    });

    it("rejects a negative number", () => {
      const error = unwrapErr(EventTime.fromUnixSeconds(-1));
      expect(error.message).toContain("EventTime must be a non-negative integer");
    });

    it("rejects a non-integer", () => {
      const error = unwrapErr(EventTime.fromUnixSeconds(1.5));
      expect(error.message).toContain("EventTime must be a non-negative integer");
    });

    it("rejects NaN/Infinity", () => {
      expect(EventTime.fromUnixSeconds(Number.NaN).ok).toBe(false);
      expect(EventTime.fromUnixSeconds(Number.POSITIVE_INFINITY).ok).toBe(false);
    });
  });
});
