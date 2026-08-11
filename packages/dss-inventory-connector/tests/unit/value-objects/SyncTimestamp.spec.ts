import { describe, expect, it } from "vitest";

import { SyncTimestamp } from "../../../src/domain/value-objects/SyncTimestamp.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("SyncTimestamp", () => {
  it("creates from a valid Date", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    const ts = unwrap(SyncTimestamp.create(date));
    expect(ts.toDate().getTime()).toBe(date.getTime());
  });

  it("rejects an invalid Date", () => {
    const error = unwrapErr(SyncTimestamp.create(new Date("not-a-date")));
    expect(error.message).toContain("valid Date");
  });

  it("rejects a non-Date value at the type boundary", () => {
    const error = unwrapErr(SyncTimestamp.create("2026-01-01" as unknown as Date));
    expect(error.message).toContain("valid Date");
  });

  it("isBefore() compares chronologically", () => {
    const earlier = unwrap(SyncTimestamp.create(new Date("2026-01-01T00:00:00.000Z")));
    const later = unwrap(SyncTimestamp.create(new Date("2026-01-02T00:00:00.000Z")));
    expect(earlier.isBefore(later)).toBe(true);
    expect(later.isBefore(earlier)).toBe(false);
  });

  it("equals() compares by value", () => {
    const a = unwrap(SyncTimestamp.create(new Date("2026-01-01T00:00:00.000Z")));
    const b = unwrap(SyncTimestamp.create(new Date("2026-01-01T00:00:00.000Z")));
    expect(a.equals(b)).toBe(true);
  });
});
