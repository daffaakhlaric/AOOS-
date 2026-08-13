import { describe, expect, it } from "vitest";

import {
  formatDateId,
  formatIdr,
  formatIdrCompact,
  formatNumber,
  formatRelativeTimeId,
} from "@/lib/formatters";

describe("formatIdr", () => {
  it("formats with Indonesian thousands grouping and no decimals", () => {
    expect(formatIdr(5_850_000)).toContain("5.850.000");
  });
});

describe("formatIdrCompact", () => {
  it("compacts millions as 'jt'", () => {
    expect(formatIdrCompact(11_700_000)).toBe("Rp 11.7jt");
  });

  it("compacts thousands as 'rb'", () => {
    expect(formatIdrCompact(5_000)).toBe("Rp 5rb");
  });

  it("falls back to formatIdr below 1,000", () => {
    expect(formatIdrCompact(500)).toContain("500");
  });
});

describe("formatNumber", () => {
  it("formats with Indonesian thousands grouping", () => {
    expect(formatNumber(1286)).toBe("1.286");
  });
});

describe("formatDateId", () => {
  it("formats an ISO date as an Indonesian short date", () => {
    expect(formatDateId("2026-08-09T00:00:00.000Z")).toMatch(/Agu/);
  });
});

describe("formatRelativeTimeId", () => {
  const now = new Date("2026-08-13T12:00:00.000Z");

  it("returns 'baru saja' for under a minute", () => {
    expect(formatRelativeTimeId("2026-08-13T11:59:45.000Z", now)).toBe("baru saja");
  });

  it("returns minutes for under an hour", () => {
    expect(formatRelativeTimeId("2026-08-13T11:45:00.000Z", now)).toBe("15 menit lalu");
  });

  it("returns hours for under a day", () => {
    expect(formatRelativeTimeId("2026-08-13T09:00:00.000Z", now)).toBe("3 jam lalu");
  });

  it("falls back to formatDateId beyond a day", () => {
    expect(formatRelativeTimeId("2026-08-01T09:00:00.000Z", now)).toMatch(/Agu/);
  });
});
