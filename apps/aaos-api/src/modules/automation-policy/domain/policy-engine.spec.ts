import { Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import type { SamanthaDecision } from "../../campaign-health/domain/decision.js";

import type { AutomationPolicy } from "./policy-engine.js";
import { evaluateAutomationPolicy } from "./policy-engine.js";

function makeDecision(overrides: Partial<SamanthaDecision> = {}): SamanthaDecision {
  return {
    decision: Verdict.SCALE,
    confidence: 0.9,
    impact: "HIGH",
    reason: "test reason",
    riskOfDoingNothing: "test risk",
    expectedOutcome: "test outcome",
    monitoringPlan: { reviewAfterHours: 48, successConditions: [], rollbackConditions: [] },
    ...overrides,
  };
}

function makePolicy(overrides: Partial<AutomationPolicy> = {}): AutomationPolicy {
  return {
    mode: "AUTOPILOT_GUARDED",
    minimumConfidence: 0.7,
    allowedAutoActions: [Verdict.SCALE],
    ...overrides,
  };
}

describe("evaluateAutomationPolicy", () => {
  describe("NO_ACTION / MONITOR early return", () => {
    const nonActionable: readonly SamanthaDecision["decision"][] = ["NO_ACTION", "MONITOR"];
    const modes: readonly AutomationPolicy["mode"][] = [
      "ADVISOR",
      "COPILOT",
      "AUTOPILOT_GUARDED",
      "AUTONOMOUS",
    ];

    for (const decisionType of nonActionable) {
      for (const mode of modes) {
        it(`decision=${decisionType}, mode=${mode} -> allowed true, requiresApproval false regardless of confidence/whitelist`, () => {
          const result = evaluateAutomationPolicy(
            makeDecision({ decision: decisionType, confidence: 0 }),
            makePolicy({ mode, minimumConfidence: 0.99, allowedAutoActions: [] }),
          );
          expect(result.allowed).toBe(true);
          expect(result.requiresApproval).toBe(false);
          expect(result.reason.length).toBeGreaterThan(0);
        });
      }
    }
  });

  describe("ADVISOR mode", () => {
    it("always requires approval regardless of confidence", () => {
      const result = evaluateAutomationPolicy(
        makeDecision({ confidence: 1 }),
        makePolicy({ mode: "ADVISOR", minimumConfidence: 0, allowedAutoActions: [Verdict.SCALE] }),
      );
      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.reason).toContain("ADVISOR");
    });
  });

  describe("COPILOT mode", () => {
    it("always requires approval regardless of confidence/whitelist", () => {
      const result = evaluateAutomationPolicy(
        makeDecision({ confidence: 1 }),
        makePolicy({ mode: "COPILOT", minimumConfidence: 0, allowedAutoActions: [Verdict.SCALE] }),
      );
      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.reason).toContain("COPILOT");
    });
  });

  describe("AUTOPILOT_GUARDED mode", () => {
    it("allows when confidence sufficient AND action whitelisted", () => {
      const result = evaluateAutomationPolicy(
        makeDecision({ decision: Verdict.SCALE, confidence: 0.8 }),
        makePolicy({
          mode: "AUTOPILOT_GUARDED",
          minimumConfidence: 0.7,
          allowedAutoActions: [Verdict.SCALE],
        }),
      );
      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(false);
    });

    it("denies with confidence-only failure reason when whitelisted but confidence too low", () => {
      const result = evaluateAutomationPolicy(
        makeDecision({ decision: Verdict.SCALE, confidence: 0.5 }),
        makePolicy({
          mode: "AUTOPILOT_GUARDED",
          minimumConfidence: 0.7,
          allowedAutoActions: [Verdict.SCALE],
        }),
      );
      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.reason).toContain("confidence");
      expect(result.reason).not.toContain("allowedAutoActions");
    });

    it("denies with whitelist-only failure reason when confidence sufficient but action not whitelisted", () => {
      const result = evaluateAutomationPolicy(
        makeDecision({ decision: Verdict.PAUSE, confidence: 0.9 }),
        makePolicy({
          mode: "AUTOPILOT_GUARDED",
          minimumConfidence: 0.7,
          allowedAutoActions: [Verdict.SCALE],
        }),
      );
      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.reason).toContain("allowedAutoActions");
      expect(result.reason).not.toContain("confidence");
    });

    it("denies with both-failure reason when both confidence too low and action not whitelisted", () => {
      const result = evaluateAutomationPolicy(
        makeDecision({ decision: Verdict.PAUSE, confidence: 0.1 }),
        makePolicy({
          mode: "AUTOPILOT_GUARDED",
          minimumConfidence: 0.7,
          allowedAutoActions: [Verdict.SCALE],
        }),
      );
      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.reason).toContain("confidence");
      expect(result.reason).toContain("allowedAutoActions");
    });

    it("treats confidence exactly equal to minimum as sufficient (>=, not >)", () => {
      const result = evaluateAutomationPolicy(
        makeDecision({ decision: Verdict.SCALE, confidence: 0.7 }),
        makePolicy({
          mode: "AUTOPILOT_GUARDED",
          minimumConfidence: 0.7,
          allowedAutoActions: [Verdict.SCALE],
        }),
      );
      expect(result.allowed).toBe(true);
    });

    it("REQUEST_KAI_CREATIVE can be whitelisted and allowed like any other RecommendedActionType", () => {
      const result = evaluateAutomationPolicy(
        makeDecision({ decision: "REQUEST_KAI_CREATIVE", confidence: 0.8 }),
        makePolicy({
          mode: "AUTOPILOT_GUARDED",
          minimumConfidence: 0.7,
          allowedAutoActions: ["REQUEST_KAI_CREATIVE"],
        }),
      );
      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(false);
    });
  });

  describe("AUTONOMOUS mode", () => {
    it("allows when confidence sufficient, ignoring allowedAutoActions entirely (empty whitelist still allows)", () => {
      const result = evaluateAutomationPolicy(
        makeDecision({ decision: Verdict.PAUSE, confidence: 0.9 }),
        makePolicy({ mode: "AUTONOMOUS", minimumConfidence: 0.7, allowedAutoActions: [] }),
      );
      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(false);
      expect(result.reason).toContain("AUTONOMOUS");
    });

    it("denies when confidence below minimum even though AUTONOMOUS", () => {
      const result = evaluateAutomationPolicy(
        makeDecision({ decision: Verdict.PAUSE, confidence: 0.5 }),
        makePolicy({ mode: "AUTONOMOUS", minimumConfidence: 0.7, allowedAutoActions: [] }),
      );
      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.reason).toContain("confidence");
    });

    it("treats confidence exactly equal to minimum as sufficient (>=, not >)", () => {
      const result = evaluateAutomationPolicy(
        makeDecision({ decision: Verdict.PAUSE, confidence: 0.7 }),
        makePolicy({ mode: "AUTONOMOUS", minimumConfidence: 0.7, allowedAutoActions: [] }),
      );
      expect(result.allowed).toBe(true);
    });

    it("allows regardless of whitelist content — a non-whitelisted action still passes", () => {
      const result = evaluateAutomationPolicy(
        makeDecision({ decision: Verdict.FIX, confidence: 1 }),
        makePolicy({
          mode: "AUTONOMOUS",
          minimumConfidence: 0.7,
          allowedAutoActions: [Verdict.SCALE],
        }),
      );
      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(false);
    });
  });

  describe("requiresApproval is always the logical negation of allowed for actionable decisions", () => {
    const modes: readonly AutomationPolicy["mode"][] = [
      "ADVISOR",
      "COPILOT",
      "AUTOPILOT_GUARDED",
      "AUTONOMOUS",
    ];
    const confidences = [0, 0.3, 0.7, 1];

    for (const mode of modes) {
      for (const confidence of confidences) {
        it(`mode=${mode}, confidence=${confidence}`, () => {
          const result = evaluateAutomationPolicy(
            makeDecision({ decision: Verdict.REVIEW, confidence }),
            makePolicy({ mode, minimumConfidence: 0.5, allowedAutoActions: [Verdict.REVIEW] }),
          );
          expect(result.requiresApproval).toBe(!result.allowed);
        });
      }
    }
  });
});
