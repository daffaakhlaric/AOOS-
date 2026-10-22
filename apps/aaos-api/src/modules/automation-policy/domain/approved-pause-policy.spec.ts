import { expect, it } from "vitest";

import { defaultGrowthPolicy } from "./growth-policy.js";
import { evaluateApprovedPausePolicy } from "./policy-engine.js";
function fixture() {
  const policy = defaultGrowthPolicy();
  policy.optimizationBasis = "META_LEAD";
  policy.conversionPolicy.primaryMetric = "LEAD";
  const evidence = {
    confidence: 0.95,
    diagnosis: "SPEND_WITHOUT_RESULT",
    daysCovered: 7,
    dataLevel: "HIGH",
    spend: 500000,
    leads: 0,
  };
  return { policy, evidence };
}
it("allows human-approved spend containment using sufficient Meta-lead evidence without claiming tracking health", () => {
  const f = fixture();
  expect(evaluateApprovedPausePolicy(f.policy, f.evidence)).toEqual([]);
});
it("blocks a business-outcome policy without substituting raw leads", () => {
  const f = fixture();
  f.policy.optimizationBasis = "BUSINESS_OUTCOME";
  expect(evaluateApprovedPausePolicy(f.policy, f.evidence)).toContain(
    "PAUSE_OUTCOME_BASIS_UNVERIFIED",
  );
});
it.each([
  { confidence: NaN },
  { confidence: 1.2 },
  { confidence: 0.1 },
  { daysCovered: NaN },
  { daysCovered: 1 },
  { dataLevel: "LOW" },
  { dataLevel: "UNKNOWN" },
  { spend: 0 },
  { spend: Infinity },
  { leads: 1 },
  { diagnosis: "CREATIVE_FATIGUE" },
])("rejects insufficient or conflicting evidence %j", (override) => {
  const f = fixture();
  expect(
    evaluateApprovedPausePolicy(f.policy, { ...f.evidence, ...override }).length,
  ).toBeGreaterThan(0);
});
it("fails closed on absent evidence", () => {
  const f = fixture();
  expect(evaluateApprovedPausePolicy(f.policy, {}).length).toBeGreaterThan(0);
});
