import { describe, expect, it } from "vitest";

import { decideCampaignPublishGuardrail } from "./campaign-publish-guardrail.js";

describe("decideCampaignPublishGuardrail", () => {
  it("HAS ACTIVE CAMPAIGN — always PENDING_REVIEW, even in LIVE mode with auto-publish ON and no budget delta", () => {
    const result = decideCampaignPublishGuardrail({
      mode: "LIVE",
      autoPublishEnabled: true,
      hasActiveCampaign: true,
      maxBudgetIncreasePct: 20,
    });
    expect(result.allowed).toBe(false);
    expect(result.status).toBe("PENDING_REVIEW");
  });

  it("DEV MODE FORCES DRAFT — mode DEV always lands on DRAFT (no real Meta spend), regardless of the toggle", () => {
    const withToggleOff = decideCampaignPublishGuardrail({
      mode: "DEV",
      autoPublishEnabled: false,
      hasActiveCampaign: false,
      maxBudgetIncreasePct: 20,
    });
    expect(withToggleOff.allowed).toBe(true);
    expect(withToggleOff.allowed && withToggleOff.status).toBe("DRAFT");

    const withToggleOn = decideCampaignPublishGuardrail({
      mode: "DEV",
      autoPublishEnabled: true,
      hasActiveCampaign: false,
      maxBudgetIncreasePct: 20,
    });
    expect(withToggleOn.allowed).toBe(true);
    expect(withToggleOn.allowed && withToggleOn.status).toBe("DRAFT");
  });

  it("LIVE + TOGGLE OFF FORCES REVIEW — mode LIVE with autoPublishEnabled false lands on PENDING_REVIEW", () => {
    const result = decideCampaignPublishGuardrail({
      mode: "LIVE",
      autoPublishEnabled: false,
      hasActiveCampaign: false,
      maxBudgetIncreasePct: 20,
    });
    expect(result.allowed).toBe(false);
    expect(result.status).toBe("PENDING_REVIEW");
  });

  it("LIVE + TOGGLE ON, NO BUDGET DELTA — publishes for real (ACTIVE) for a brand-new campaign", () => {
    const result = decideCampaignPublishGuardrail({
      mode: "LIVE",
      autoPublishEnabled: true,
      hasActiveCampaign: false,
      maxBudgetIncreasePct: 20,
    });
    expect(result.allowed).toBe(true);
    expect(result.allowed && result.status).toBe("ACTIVE");
  });

  it("LIVE + TOGGLE ON, WITHIN GUARDRAIL — publishes for real (ACTIVE) when budgetIncreasePct is under the cap", () => {
    const result = decideCampaignPublishGuardrail({
      mode: "LIVE",
      autoPublishEnabled: true,
      hasActiveCampaign: false,
      budgetIncreasePct: 15,
      maxBudgetIncreasePct: 20,
    });
    expect(result.allowed).toBe(true);
    expect(result.allowed && result.status).toBe("ACTIVE");
  });

  it("LIVE + TOGGLE ON, EXACTLY AT THE CAP — publishes for real (ACTIVE); the cap is inclusive", () => {
    const result = decideCampaignPublishGuardrail({
      mode: "LIVE",
      autoPublishEnabled: true,
      hasActiveCampaign: false,
      budgetIncreasePct: 20,
      maxBudgetIncreasePct: 20,
    });
    expect(result.allowed).toBe(true);
    expect(result.allowed && result.status).toBe("ACTIVE");
  });

  it("GUARDRAIL ACTUALLY BLOCKS (not just warns) — LIVE + auto-publish ON + budgetIncreasePct exceeding maxBudgetIncreasePct falls back to PENDING_REVIEW, never ACTIVE", () => {
    const result = decideCampaignPublishGuardrail({
      mode: "LIVE",
      autoPublishEnabled: true,
      hasActiveCampaign: false,
      budgetIncreasePct: 25,
      maxBudgetIncreasePct: 20,
    });
    expect(result.allowed).toBe(false);
    expect(result.status).toBe("PENDING_REVIEW");
    // The blocking behavior is a real, structural refusal (allowed: false / status:
    // PENDING_REVIEW), not merely a warning string attached to an otherwise-ACTIVE result — this
    // assertion is the literal proof the user's own checklist item demands ("bukan cuma warning").
    expect(result).not.toMatchObject({ status: "ACTIVE" });
  });

  it("SAFETY DEFAULT — with autoPublishEnabled explicitly false (the real DB column default) in LIVE mode, the result is NEVER ACTIVE — it always requires review, regardless of budgetIncreasePct", () => {
    const withinCap = decideCampaignPublishGuardrail({
      mode: "LIVE",
      autoPublishEnabled: false,
      hasActiveCampaign: false,
      budgetIncreasePct: 5,
      maxBudgetIncreasePct: 20,
    });
    expect(withinCap.allowed).toBe(false);
    expect(withinCap.status).toBe("PENDING_REVIEW");

    const noDelta = decideCampaignPublishGuardrail({
      mode: "LIVE",
      autoPublishEnabled: false,
      hasActiveCampaign: false,
      maxBudgetIncreasePct: 20,
    });
    expect(noDelta.status).toBe("PENDING_REVIEW");
  });
});
