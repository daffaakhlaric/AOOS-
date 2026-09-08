import { describe, expect, it } from "vitest";

import { getSeasonalitySignal } from "./market-signals.js";

describe("getSeasonalitySignal", () => {
  it("is always available: true — a real static calendar has no failure mode", () => {
    const signal = getSeasonalitySignal(new Date("2026-08-20T10:00:00.000Z"));
    expect(signal.available).toBe(true);
  });

  it("reports musim ramai / THR within the real Lebaran 2026 window (2026-03-20, astronomical estimate)", () => {
    // 10 days before the real Lebaran 2026 estimate — inside the [-21, +21] window.
    const signal = getSeasonalitySignal(new Date("2026-03-10T00:00:00.000Z"));
    expect(signal.status).toBe("musim ramai");
    expect(signal.eventName).toBe("THR/Lebaran");
    expect(signal.recommendedAngleNote).toBe("DP_RINGAN");
  });

  it("reports musim ramai / Tahun Ajaran Baru in June", () => {
    const signal = getSeasonalitySignal(new Date("2026-06-15T00:00:00.000Z"));
    expect(signal.status).toBe("musim ramai");
    expect(signal.eventName).toBe("Tahun Ajaran Baru");
  });

  it("reports musim ramai / Tahun Ajaran Baru in July", () => {
    const signal = getSeasonalitySignal(new Date("2026-07-15T00:00:00.000Z"));
    expect(signal.status).toBe("musim ramai");
    expect(signal.eventName).toBe("Tahun Ajaran Baru");
  });

  it("reports musim ramai / Akhir Tahun/Pajak in November", () => {
    const signal = getSeasonalitySignal(new Date("2026-11-10T00:00:00.000Z"));
    expect(signal.status).toBe("musim ramai");
    expect(signal.eventName).toBe("Akhir Tahun/Pajak");
  });

  it("reports musim ramai / Akhir Tahun/Pajak in December", () => {
    const signal = getSeasonalitySignal(new Date("2026-12-10T00:00:00.000Z"));
    expect(signal.status).toBe("musim ramai");
    expect(signal.eventName).toBe("Akhir Tahun/Pajak");
  });

  it("reports musim sepi with a real days-until-next-window note outside every window", () => {
    // Today (per this dispatch's system clock), 2026-09-08 — well clear of THR (2026-03-20),
    // Tahun Ajaran Baru (June/July), and Akhir Tahun/Pajak (Nov/Dec).
    const signal = getSeasonalitySignal(new Date("2026-09-08T00:00:00.000Z"));
    expect(signal.status).toBe("musim sepi");
    expect(signal.eventName).toBeUndefined();
    expect(signal.note).toContain("hari");
  });

  it("never fabricates a recommendedAngleNote outside a real active window", () => {
    const signal = getSeasonalitySignal(new Date("2026-09-08T00:00:00.000Z"));
    expect(signal.recommendedAngleNote).toBeUndefined();
  });
});
