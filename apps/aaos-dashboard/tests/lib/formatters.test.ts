import { describe, expect, it } from "vitest";

import {
  formatDateId,
  formatIdr,
  formatIdrCompact,
  formatNumber,
  formatPercent,
  formatRelativeTimeId,
} from "@/lib/formatters";

describe("formatIdr", () => {
  it("formats a rupiah amount with thousands grouping and no decimals", () => {
    expect(formatIdr(26_400_000)).toMatch(/^Rp\s?26\.400\.000$/);
  });
});

describe("formatIdrCompact", () => {
  it("compacts millions to 'jt'", () => {
    expect(formatIdrCompact(26_400_000)).toBe("Rp 26.4jt");
  });

  it("compacts thousands to 'rb'", () => {
    expect(formatIdrCompact(1_500)).toBe("Rp 2rb");
  });

  it("falls back to formatIdr below 1,000", () => {
    expect(formatIdrCompact(500)).toMatch(/^Rp\s?500$/);
  });
});

describe("formatNumber", () => {
  it("formats with Indonesian thousands grouping", () => {
    expect(formatNumber(1286)).toBe("1.286");
  });
});

describe("formatPercent", () => {
  it("rounds a fraction to a whole percent", () => {
    expect(formatPercent(0.94)).toBe("94%");
  });

  it("rounds down/up correctly at the boundary", () => {
    expect(formatPercent(0.005)).toBe("1%");
  });
});

describe("formatDateId", () => {
  it("formats an ISO date as an Indonesian short date", () => {
    expect(formatDateId("2026-08-09T00:00:00.000Z")).toMatch(/09 Agu 2026/);
  });
});

describe("formatRelativeTimeId", () => {
  const now = new Date("2026-08-11T12:00:00.000Z");

  it("returns 'baru saja' for under a minute", () => {
    expect(formatRelativeTimeId("2026-08-11T11:59:45.000Z", now)).toBe("baru saja");
  });

  it("returns minutes for under an hour", () => {
    expect(formatRelativeTimeId("2026-08-11T11:46:00.000Z", now)).toBe("14 menit lalu");
  });

  it("returns hours for under a day", () => {
    expect(formatRelativeTimeId("2026-08-11T11:00:00.000Z", now)).toBe("1 jam lalu");
  });

  it("falls back to formatDateId at a day or older", () => {
    expect(formatRelativeTimeId("2026-08-09T12:00:00.000Z", now)).toMatch(/09 Agu 2026/);
  });
});
