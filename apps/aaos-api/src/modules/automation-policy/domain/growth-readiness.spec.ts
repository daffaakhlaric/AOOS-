import { expect, it } from "vitest";

import { defaultGrowthPolicy } from "./growth-policy.js";
import { growthReadiness } from "./growth-readiness.js";
import { evaluateGrowthPolicy } from "./policy-engine.js";
it("makes CRM independent capabilities available without claiming autonomous scaling", () => {
  const p = defaultGrowthPolicy();
  p.optimizationBasis = "META_LEAD";
  const r = growthReadiness(p, {
    metaConfigured: true,
    schedulerEnabled: true,
    creativeConfigured: true,
  });
  expect(r.actions.filter((a) => a.available).map((a) => a.key)).toEqual([
    "ANALYZE",
    "CREATE_CAMPAIGN_DRAFT",
    "APPROVE",
    "REQUEST_KAI_REFRESH",
  ]);
  expect(r.actions.find((a) => a.key === "SCALE")?.available).toBe(false);
});
it("does not require CRM for explicit Meta lead optimization, but keeps tracking and budget guards", () => {
  const p = defaultGrowthPolicy();
  p.optimizationBasis = "META_LEAD";
  const r = evaluateGrowthPolicy(p, {
    action: "SCALE",
    policyVersion: 1,
    currentPolicyVersion: 1,
    confidence: 0.9,
  });
  expect(r.blocked).not.toContain("CRM_STALE_OR_MISSING");
  expect(r.blocked).toContain("TRACKING_UNVERIFIED");
  expect(r.blocked).toContain("INVALID_BUDGET_TARGET");
});
