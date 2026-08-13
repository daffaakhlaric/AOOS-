import { describe, expect, it } from "vitest";

import {
  evaluateVerdict,
  type VerdictEngineInput,
} from "../../../../src/domain/services/VerdictEngine.js";
import { CampaignObjective } from "../../../../src/domain/value-objects/CampaignObjective.js";
import { Rph } from "../../../../src/domain/value-objects/Rph.js";
import { Verdict } from "../../../../src/domain/value-objects/Verdict.js";

/**
 * AAOS-W1D-S3, coordinator note correction #1: `evaluateVerdict`'s FIX check is now derived as
 * "objective !== OUTCOME_LEADS" rather than a hardcoded partial list — this dedicated file pins
 * that every non-OUTCOME_LEADS member of `CampaignObjective` (including `OUTCOME_SALES`, which
 * the original spec's own hardcoded `FIX_OBJECTIVES` example omitted) triggers FIX, and that
 * OUTCOME_LEADS itself does not, regardless of how good/bad every other metric is.
 */
function input(overrides: Partial<VerdictEngineInput> = {}): VerdictEngineInput {
  return {
    rphChat: Rph.calculate(5_000, 1),
    conversations: 10,
    spendAmount: 100_000,
    frequency: 1,
    objective: CampaignObjective.OUTCOME_LEADS,
    ...overrides,
  };
}

describe("VerdictEngine — FIX trigger derived from objective !== OUTCOME_LEADS (AAOS-W1D-S3)", () => {
  it("OUTCOME_ENGAGEMENT → Verdict.FIX (previously only VISIT_INSTAGRAM_PROFILE triggered FIX)", () => {
    expect(evaluateVerdict(input({ objective: CampaignObjective.OUTCOME_ENGAGEMENT }))).toBe(
      Verdict.FIX,
    );
  });

  it("LINK_CLICKS → Verdict.FIX", () => {
    expect(evaluateVerdict(input({ objective: CampaignObjective.LINK_CLICKS }))).toBe(Verdict.FIX);
  });

  it("VISIT_INSTAGRAM_PROFILE → Verdict.FIX (unchanged from before)", () => {
    expect(evaluateVerdict(input({ objective: CampaignObjective.VISIT_INSTAGRAM_PROFILE }))).toBe(
      Verdict.FIX,
    );
  });

  it("OUTCOME_SALES → Verdict.FIX (coordinator note correction #1 — omitted from the spec's own hardcoded FIX_OBJECTIVES list, caught by the derived check instead)", () => {
    expect(evaluateVerdict(input({ objective: CampaignObjective.OUTCOME_SALES }))).toBe(
      Verdict.FIX,
    );
  });

  it("OUTCOME_LEADS → NOT FIX (the correct objective — falls through to the normal performance-threshold rules)", () => {
    expect(evaluateVerdict(input({ objective: CampaignObjective.OUTCOME_LEADS }))).not.toBe(
      Verdict.FIX,
    );
  });

  it("OUTCOME_LEADS still evaluates SCALE/KEEP/PAUSE/REFRESH/REVIEW normally (FIX no longer masks them)", () => {
    expect(
      evaluateVerdict(
        input({
          objective: CampaignObjective.OUTCOME_LEADS,
          rphChat: Rph.calculate(5_500, 1),
          conversations: 25,
        }),
      ),
    ).toBe(Verdict.SCALE);
  });

  it("every non-OUTCOME_LEADS objective FIXes even when every other metric is excellent", () => {
    const nonLeadsObjectives = Object.values(CampaignObjective).filter(
      (o) => o !== CampaignObjective.OUTCOME_LEADS,
    );
    for (const objective of nonLeadsObjectives) {
      expect(
        evaluateVerdict(
          input({ objective, rphChat: Rph.calculate(100, 1), conversations: 1000, frequency: 0 }),
        ),
      ).toBe(Verdict.FIX);
    }
  });
});
