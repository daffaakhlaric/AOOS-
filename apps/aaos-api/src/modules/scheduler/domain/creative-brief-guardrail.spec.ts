import { describe, expect, it } from "vitest";

import { decideCreativeBriefGuardrail } from "./creative-brief-guardrail.js";

describe("decideCreativeBriefGuardrail", () => {
  it("DAILY CAP — skips (allowed: false) when autoBriefsToday has reached maxAutoBriefsPerDay", () => {
    const result = decideCreativeBriefGuardrail({
      mode: "LIVE",
      autoApproveEnabled: true,
      autoBriefsToday: 5,
      maxAutoBriefsPerDay: 5,
    });
    expect(result.allowed).toBe(false);
  });

  it("DAILY CAP — skips (allowed: false) when autoBriefsToday exceeds maxAutoBriefsPerDay", () => {
    const result = decideCreativeBriefGuardrail({
      mode: "DEV",
      autoApproveEnabled: false,
      autoBriefsToday: 6,
      maxAutoBriefsPerDay: 5,
    });
    expect(result.allowed).toBe(false);
  });

  it("DAILY CAP — the cap check runs BEFORE mode/toggle, even for LIVE + toggle ON", () => {
    const result = decideCreativeBriefGuardrail({
      mode: "LIVE",
      autoApproveEnabled: true,
      autoBriefsToday: 5,
      maxAutoBriefsPerDay: 5,
    });
    expect(result.allowed).toBe(false);
  });

  it("allows when under the daily cap", () => {
    const result = decideCreativeBriefGuardrail({
      mode: "DEV",
      autoApproveEnabled: false,
      autoBriefsToday: 4,
      maxAutoBriefsPerDay: 5,
    });
    expect(result.allowed).toBe(true);
  });

  it("DEV MODE FORCES REVIEW — mode DEV always lands on PENDING_REVIEW, regardless of the toggle", () => {
    const withToggleOff = decideCreativeBriefGuardrail({
      mode: "DEV",
      autoApproveEnabled: false,
      autoBriefsToday: 0,
      maxAutoBriefsPerDay: 5,
    });
    expect(withToggleOff.allowed).toBe(true);
    expect(withToggleOff.allowed && withToggleOff.status).toBe("PENDING_REVIEW");

    const withToggleOn = decideCreativeBriefGuardrail({
      mode: "DEV",
      autoApproveEnabled: true,
      autoBriefsToday: 0,
      maxAutoBriefsPerDay: 5,
    });
    expect(withToggleOn.allowed).toBe(true);
    expect(withToggleOn.allowed && withToggleOn.status).toBe("PENDING_REVIEW");
  });

  it("LIVE + TOGGLE OFF FORCES REVIEW — mode LIVE with autoApproveEnabled false lands on PENDING_REVIEW", () => {
    const result = decideCreativeBriefGuardrail({
      mode: "LIVE",
      autoApproveEnabled: false,
      autoBriefsToday: 0,
      maxAutoBriefsPerDay: 5,
    });
    expect(result.allowed).toBe(true);
    expect(result.allowed && result.status).toBe("PENDING_REVIEW");
  });

  it("LIVE + TOGGLE ON PROCEEDS — mode LIVE with autoApproveEnabled true lands on DRAFT (no review needed)", () => {
    const result = decideCreativeBriefGuardrail({
      mode: "LIVE",
      autoApproveEnabled: true,
      autoBriefsToday: 0,
      maxAutoBriefsPerDay: 5,
    });
    expect(result.allowed).toBe(true);
    expect(result.allowed && result.status).toBe("DRAFT");
  });

  it("SAFETY DEFAULT — with autoApproveEnabled explicitly false (the real DB column default) in LIVE mode, the result is NEVER DRAFT — it always requires review", () => {
    const result = decideCreativeBriefGuardrail({
      mode: "LIVE",
      autoApproveEnabled: false,
      autoBriefsToday: 0,
      maxAutoBriefsPerDay: 5,
    });
    expect(result.allowed).toBe(true);
    expect(result.allowed && result.status).not.toBe("DRAFT");
    expect(result.allowed && result.status).toBe("PENDING_REVIEW");
  });
});
