import { describe, expect, it } from "vitest";

import {
  evaluateVerdict,
  getVerdictReason,
  LEARNING_PHASE_PAUSE_SUPPRESSED_REASON,
  LEARNING_PHASE_SCALE_SUPPRESSED_REASON,
  type VerdictEngineInput,
} from "../../../../src/domain/services/VerdictEngine.js";
import { CampaignObjective } from "../../../../src/domain/value-objects/CampaignObjective.js";
import { Rph } from "../../../../src/domain/value-objects/Rph.js";
import { Verdict } from "../../../../src/domain/value-objects/Verdict.js";

function rph(value: number): Rph {
  return Rph.calculate(value, 1);
}

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

/**
 * AAOS Samantha Professional Optimizer, Part A — Learning Phase awareness. A SEPARATE spec file
 * (not appended to the pre-existing `VerdictEngine.spec.ts`) so that file's own pre-existing test
 * suite is provably left byte-for-byte unmodified, per this dispatch's own regression discipline.
 */
describe("VerdictEngine — Learning Phase awareness", () => {
  describe("PAUSE suppression during LEARNING", () => {
    it("suppresses a would-be PAUSE (rphChat > 22,000) to REVIEW when learningStatus is LEARNING", () => {
      const result = evaluateVerdict(input({ rphChat: rph(30_000), learningStatus: "LEARNING" }));
      expect(result).toBe(Verdict.REVIEW);
    });

    it("suppresses a would-be PAUSE (zero conversations, positive spend) to REVIEW when learningStatus is LEARNING", () => {
      const result = evaluateVerdict(
        input({
          rphChat: Rph.undefined_(),
          conversations: 0,
          spendAmount: 50_000,
          learningStatus: "LEARNING",
        }),
      );
      expect(result).toBe(Verdict.REVIEW);
    });

    it("returns the real, honest PAUSE-suppressed reason text via getVerdictReason", () => {
      const suppressedInput = input({ rphChat: rph(30_000), learningStatus: "LEARNING" });
      expect(getVerdictReason(suppressedInput)).toBe(LEARNING_PHASE_PAUSE_SUPPRESSED_REASON);
    });
  });

  describe("SCALE suppression during LEARNING", () => {
    it("suppresses a would-be SCALE to KEEP when learningStatus is LEARNING", () => {
      const result = evaluateVerdict(
        input({ rphChat: rph(5_000), conversations: 30, learningStatus: "LEARNING" }),
      );
      expect(result).toBe(Verdict.KEEP);
    });

    it("returns the real, honest SCALE-suppressed reason text via getVerdictReason", () => {
      const suppressedInput = input({
        rphChat: rph(5_000),
        conversations: 30,
        learningStatus: "LEARNING",
      });
      expect(getVerdictReason(suppressedInput)).toBe(LEARNING_PHASE_SCALE_SUPPRESSED_REASON);
    });
  });

  describe("unaffected verdicts during LEARNING", () => {
    it("still FIXes regardless of learningStatus (objective correctness outranks Learning Phase)", () => {
      const result = evaluateVerdict(
        input({
          objective: CampaignObjective.VISIT_INSTAGRAM_PROFILE,
          learningStatus: "LEARNING",
        }),
      );
      expect(result).toBe(Verdict.FIX);
    });

    it("still REFRESHes on high frequency during LEARNING (not a PAUSE/SCALE suppression case)", () => {
      const result = evaluateVerdict(
        input({ rphChat: rph(5_000), conversations: 5, frequency: 4, learningStatus: "LEARNING" }),
      );
      expect(result).toBe(Verdict.REFRESH);
    });

    it("still KEEPs when the raw verdict was already KEEP during LEARNING (nothing to suppress)", () => {
      const result = evaluateVerdict(
        input({ rphChat: rph(9_000), conversations: 10, learningStatus: "LEARNING" }),
      );
      expect(result).toBe(Verdict.KEEP);
      expect(
        getVerdictReason(
          input({ rphChat: rph(9_000), conversations: 10, learningStatus: "LEARNING" }),
        ),
      ).toBeUndefined();
    });
  });

  describe("LEARNING_LIMITED and SUCCESS are honestly NOT suppressed (out of this dispatch's verified scope)", () => {
    it("does NOT suppress PAUSE when learningStatus is LEARNING_LIMITED", () => {
      const result = evaluateVerdict(
        input({ rphChat: rph(30_000), learningStatus: "LEARNING_LIMITED" }),
      );
      expect(result).toBe(Verdict.PAUSE);
    });

    it("does NOT suppress SCALE when learningStatus is SUCCESS", () => {
      const result = evaluateVerdict(
        input({ rphChat: rph(5_000), conversations: 30, learningStatus: "SUCCESS" }),
      );
      expect(result).toBe(Verdict.SCALE);
    });

    it("getVerdictReason is undefined for LEARNING_LIMITED/SUCCESS even for a would-be-PAUSE input", () => {
      expect(
        getVerdictReason(input({ rphChat: rph(30_000), learningStatus: "LEARNING_LIMITED" })),
      ).toBeUndefined();
      expect(
        getVerdictReason(input({ rphChat: rph(30_000), learningStatus: "SUCCESS" })),
      ).toBeUndefined();
    });
  });

  describe("undefined learningStatus (default) behaves exactly like today, no regression", () => {
    it("PAUSEs normally when learningStatus is omitted", () => {
      expect(evaluateVerdict(input({ rphChat: rph(30_000) }))).toBe(Verdict.PAUSE);
    });

    it("SCALEs normally when learningStatus is omitted", () => {
      expect(evaluateVerdict(input({ rphChat: rph(5_000), conversations: 30 }))).toBe(
        Verdict.SCALE,
      );
    });

    it("getVerdictReason is undefined when learningStatus is omitted", () => {
      expect(getVerdictReason(input({ rphChat: rph(30_000) }))).toBeUndefined();
    });
  });
});
