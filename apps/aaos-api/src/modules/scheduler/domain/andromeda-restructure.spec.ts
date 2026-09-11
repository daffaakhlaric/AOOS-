import type { CreativeDiversityScore } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import {
  evaluateAndromedaRestructureCandidate,
  MIN_AD_SETS_FOR_RESTRUCTURE_CANDIDATE,
} from "./andromeda-restructure.js";

const LOW_DIVERSITY: CreativeDiversityScore = {
  status: "LOW_DIVERSITY",
  totalAdCount: 6,
  distinctCreativeAssetCount: 2,
  reasoning: "2 creative asset unik dari 6 ad (rasio 0.33)",
};

const DIVERSE: CreativeDiversityScore = {
  status: "DIVERSE",
  totalAdCount: 6,
  distinctCreativeAssetCount: 5,
  reasoning: "5 creative asset unik dari 6 ad (rasio 0.83)",
};

const NOT_ENOUGH_DATA: CreativeDiversityScore = {
  status: "NOT_ENOUGH_DATA",
  totalAdCount: 2,
  reasoning: "Hanya 2 ad",
};

describe("evaluateAndromedaRestructureCandidate", () => {
  it("triggers when adSetCount is at/above the fragmentation threshold AND diversity is LOW_DIVERSITY", () => {
    const result = evaluateAndromedaRestructureCandidate({
      adSetCount: MIN_AD_SETS_FOR_RESTRUCTURE_CANDIDATE,
      diversity: LOW_DIVERSITY,
    });
    expect(result.triggered).toBe(true);
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain("Andromeda");
  });

  it("does NOT trigger when the campaign has only 1 ad set, even with LOW_DIVERSITY (can't be 'fragmented' across ad sets)", () => {
    const result = evaluateAndromedaRestructureCandidate({
      adSetCount: 1,
      diversity: LOW_DIVERSITY,
    });
    expect(result.triggered).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it("does NOT trigger when diversity is DIVERSE, even with many ad sets", () => {
    const result = evaluateAndromedaRestructureCandidate({
      adSetCount: 5,
      diversity: DIVERSE,
    });
    expect(result.triggered).toBe(false);
  });

  it("does NOT trigger on NOT_ENOUGH_DATA — never fabricates a trigger from an unconfirmed signal", () => {
    const result = evaluateAndromedaRestructureCandidate({
      adSetCount: 5,
      diversity: NOT_ENOUGH_DATA,
    });
    expect(result.triggered).toBe(false);
  });

  /**
   * THE SINGLE MOST IMPORTANT TEST IN THIS DISPATCH — proves this function's return shape makes
   * auto-execution structurally impossible: there is no `status`/`allowed` field anywhere on
   * `AndromedaRestructureEvaluation` that a caller could branch into an "execute automatically"
   * path (unlike `decideCreativeBriefGuardrail`/`decideCampaignPublishGuardrail`, which DO have a
   * real auto-executing branch gated on mode/toggle). Every real trigger from this function, in
   * EVERY tenant mode and EVERY toggle state (neither of which this function even accepts as
   * input — a deliberate omission), can only ever mean one thing downstream:
   * `SchedulerService.runAndromedaRestructureCheck` enqueues a `pending_agent_actions` row and
   * NEVER calls any real Meta-mutating code path directly. See
   * `pending-actions.service.spec.ts`'s own "SAFETY DEFAULT" test for the complementary proof that
   * only `PendingActionsService.approve()` (a human's real Approve click) can ever invoke the real
   * `RestructureCampaign` Meta mutation.
   */
  it("SAFETY DEFAULT — the evaluation result never carries an execution/approval status field of any kind, in ANY triggered case: only {triggered, reason} — auto-execution is structurally impossible from this function alone", () => {
    const triggeredResult = evaluateAndromedaRestructureCandidate({
      adSetCount: 10,
      diversity: LOW_DIVERSITY,
    });
    expect(triggeredResult.triggered).toBe(true);
    expect(Object.keys(triggeredResult).sort()).toEqual(["reason", "triggered"]);
    // Explicitly assert the shape carries NO status/mode/approval-like field this session's other
    // guardrail functions (`decideCreativeBriefGuardrail`/`decideCampaignPublishGuardrail`) use for
    // their own real auto-executing branches.
    expect((triggeredResult as Record<string, unknown>)["status"]).toBeUndefined();
    expect((triggeredResult as Record<string, unknown>)["allowed"]).toBeUndefined();
  });
});
