import { describe, expect, it } from "vitest";

import {
  evaluateVerdict,
  type VerdictEngineInput,
} from "../../../../src/domain/services/VerdictEngine.js";
import { CampaignObjective } from "../../../../src/domain/value-objects/CampaignObjective.js";
import { Rph } from "../../../../src/domain/value-objects/Rph.js";
import { Verdict } from "../../../../src/domain/value-objects/Verdict.js";

function rph(value: number): Rph {
  return Rph.calculate(value, 1);
}

/**
 * AAOS-W1D-S3: defaults to `OUTCOME_LEADS` (the correct/non-FIX objective) so every describe
 * block below that doesn't explicitly test the FIX rule keeps exercising the
 * SCALE/PAUSE/REFRESH/KEEP/REVIEW thresholds in isolation — since FIX now triggers for ANY
 * objective other than `OUTCOME_LEADS` (see `VerdictEngine.ts`), leaving the old
 * `OUTCOME_ENGAGEMENT` default here would make every one of those tests observe FIX instead of
 * the verdict they're actually about. The dedicated "FIX" describe block below still explicitly
 * overrides `objective` per case.
 */
function input(overrides: Partial<VerdictEngineInput> = {}): VerdictEngineInput {
  return {
    rphChat: rph(10_000),
    conversations: 10,
    spendAmount: 100_000,
    frequency: 1,
    objective: CampaignObjective.OUTCOME_LEADS,
    ...overrides,
  };
}

describe("VerdictEngine — evaluateVerdict", () => {
  describe("SCALE — rphChat <= 5,500 AND conversations >= 25", () => {
    it("SCALEs exactly at the 5,500 / 25 boundary", () => {
      expect(evaluateVerdict(input({ rphChat: rph(5_500), conversations: 25 }))).toBe(
        Verdict.SCALE,
      );
    });

    it("SCALEs just below the rphChat threshold with conversations above minimum", () => {
      expect(evaluateVerdict(input({ rphChat: rph(5_499), conversations: 30 }))).toBe(
        Verdict.SCALE,
      );
    });

    it("does NOT scale at rphChat 5,501 (just above threshold) even with high conversations", () => {
      expect(evaluateVerdict(input({ rphChat: rph(5_501), conversations: 100 }))).not.toBe(
        Verdict.SCALE,
      );
    });

    it("does NOT scale at conversations 24 (just below minimum) even with a great rphChat", () => {
      expect(evaluateVerdict(input({ rphChat: rph(5_500), conversations: 24 }))).not.toBe(
        Verdict.SCALE,
      );
    });

    it("falls through to KEEP when rphChat qualifies but conversations is below 25", () => {
      expect(evaluateVerdict(input({ rphChat: rph(5_000), conversations: 5, frequency: 1 }))).toBe(
        Verdict.KEEP,
      );
    });
  });

  describe("KEEP — rphChat <= 9,000", () => {
    it("KEEPs exactly at 9,000 (below SCALE conversation minimum)", () => {
      expect(evaluateVerdict(input({ rphChat: rph(9_000), conversations: 10, frequency: 1 }))).toBe(
        Verdict.KEEP,
      );
    });

    it("does NOT keep at 9,001 — falls to REVIEW", () => {
      expect(evaluateVerdict(input({ rphChat: rph(9_001), conversations: 10, frequency: 1 }))).toBe(
        Verdict.REVIEW,
      );
    });
  });

  describe("REVIEW — rphChat 9,000–22,000 (exclusive of the KEEP/PAUSE boundaries)", () => {
    it("REVIEWs just above KEEP's ceiling (9,001)", () => {
      expect(evaluateVerdict(input({ rphChat: rph(9_001), frequency: 1 }))).toBe(Verdict.REVIEW);
    });

    it("REVIEWs at exactly 22,000 (PAUSE requires STRICTLY greater than 22,000)", () => {
      expect(evaluateVerdict(input({ rphChat: rph(22_000), frequency: 1 }))).toBe(Verdict.REVIEW);
    });

    it("REVIEWs an ad with undefined rphChat (0 spend, 0 conversations) as the terminal fallback", () => {
      expect(
        evaluateVerdict(
          input({ rphChat: Rph.undefined_(), conversations: 0, spendAmount: 0, frequency: 1 }),
        ),
      ).toBe(Verdict.REVIEW);
    });
  });

  describe("PAUSE — rphChat > 22,000 OR (conversations === 0 AND spend > 0)", () => {
    it("does NOT pause at exactly 22,000", () => {
      expect(evaluateVerdict(input({ rphChat: rph(22_000), frequency: 1 }))).not.toBe(
        Verdict.PAUSE,
      );
    });

    it("PAUSEs at exactly 22,001", () => {
      expect(evaluateVerdict(input({ rphChat: rph(22_001), frequency: 1 }))).toBe(Verdict.PAUSE);
    });

    it("PAUSEs a zero-conversation ad with positive spend, regardless of rphChat being undefined", () => {
      expect(
        evaluateVerdict(
          input({ rphChat: Rph.undefined_(), conversations: 0, spendAmount: 50_000, frequency: 1 }),
        ),
      ).toBe(Verdict.PAUSE);
    });

    it("does NOT pause a zero-conversation, zero-spend ad (goes to REVIEW instead)", () => {
      expect(
        evaluateVerdict(
          input({ rphChat: Rph.undefined_(), conversations: 0, spendAmount: 0, frequency: 1 }),
        ),
      ).toBe(Verdict.REVIEW);
    });
  });

  describe("REFRESH — frequency >= 3.5", () => {
    it("REFRESHes exactly at frequency 3.5 when otherwise KEEP-eligible", () => {
      expect(
        evaluateVerdict(input({ rphChat: rph(5_000), conversations: 5, frequency: 3.5 })),
      ).toBe(Verdict.REFRESH);
    });

    it("does NOT refresh at frequency 3.49 — falls to KEEP", () => {
      expect(
        evaluateVerdict(input({ rphChat: rph(5_000), conversations: 5, frequency: 3.49 })),
      ).toBe(Verdict.KEEP);
    });
  });

  describe("FIX — objective === VISIT_INSTAGRAM_PROFILE", () => {
    it("FIXes regardless of how good every other metric is", () => {
      expect(
        evaluateVerdict(
          input({
            objective: CampaignObjective.VISIT_INSTAGRAM_PROFILE,
            rphChat: rph(100),
            conversations: 1000,
            frequency: 0,
          }),
        ),
      ).toBe(Verdict.FIX);
    });

    it("FIXes even when PAUSE conditions also apply", () => {
      expect(
        evaluateVerdict(
          input({
            objective: CampaignObjective.VISIT_INSTAGRAM_PROFILE,
            conversations: 0,
            spendAmount: 100_000,
          }),
        ),
      ).toBe(Verdict.FIX);
    });
  });

  describe("documented precedence rule (FIX > PAUSE > SCALE > REFRESH > KEEP > REVIEW)", () => {
    it("PAUSE wins over REFRESH when rphChat > 22,000 AND frequency >= 3.5 simultaneously", () => {
      expect(
        evaluateVerdict(input({ rphChat: rph(30_000), frequency: 5, conversations: 10 })),
      ).toBe(Verdict.PAUSE);
    });

    it("SCALE wins over REFRESH when both the SCALE and REFRESH conditions hold", () => {
      expect(evaluateVerdict(input({ rphChat: rph(5_000), conversations: 30, frequency: 4 }))).toBe(
        Verdict.SCALE,
      );
    });

    it("FIX wins over PAUSE's zero-conversation-with-spend rule", () => {
      expect(
        evaluateVerdict(
          input({
            objective: CampaignObjective.VISIT_INSTAGRAM_PROFILE,
            conversations: 0,
            spendAmount: 1,
          }),
        ),
      ).toBe(Verdict.FIX);
    });

    it("REFRESH wins over KEEP when both hold (frequency >= 3.5 and rphChat <= 9,000)", () => {
      expect(evaluateVerdict(input({ rphChat: rph(1_000), conversations: 1, frequency: 10 }))).toBe(
        Verdict.REFRESH,
      );
    });
  });
});
