import { expect, it } from "vitest";

import { defaultGrowthPolicy, GrowthPolicySchema } from "./growth-policy.js";
import { evaluateGrowthPolicy, type GrowthExecutionEvidence } from "./policy-engine.js";
const evidence: GrowthExecutionEvidence = {
  action: "SCALE",
  policyVersion: 1,
  currentPolicyVersion: 1,
  confidence: 0.95,
  trackingHealthy: true,
  learningProtected: false,
  dataSufficient: true,
  campaignActive: true,
  crmAgeHours: 1,
  qualifiedRate: 0.5,
  hoursSinceEdit: 100,
  observationHours: 100,
  leads: 50,
  currentBudget: 100000,
  requestedBudget: 110000,
  accountDailySpend: 100000,
  monthSpend: 1000000,
};
function enabled() {
  const p = defaultGrowthPolicy();
  p.autonomousMode = "AUTONOMOUS";
  p.safetyPolicy.permissions.SCALE = "AUTO";
  p.budgetPolicy.autoScaleEnabled = true;
  p.budgetPolicy.dailyBudgetCeiling = 500000;
  p.budgetPolicy.accountDailySpendCap = 1000000;
  p.budgetPolicy.monthlySpendCap = 30000000;
  return p;
}
it("defaults to copilot with required quality gates", () => {
  const p = defaultGrowthPolicy();
  expect(p.autonomousMode).toBe("COPILOT");
  expect(p.creativePolicy.simulationRequired).toBe(true);
});
it("rejects contradictory budgets and capacity", () => {
  const p = defaultGrowthPolicy();
  p.budgetPolicy.dailyBudgetFloor = 800000;
  p.budgetPolicy.dailyBudgetCeiling = 500000;
  expect(GrowthPolicySchema.safeParse(p).success).toBe(false);
});
it("bounds pace by tenant cap", () => {
  const p = enabled();
  p.pace = "MAX_GROWTH";
  p.budgetPolicy.maxScalePercentPerAction = 15;
  expect(evaluateGrowthPolicy(p, { ...evidence, requestedBudget: 125000 }).blocked).toContain(
    "SCALE_STEP_CAP",
  );
});
it("blocks stale policy and critical tracking even in maximum mode", () => {
  const p = enabled();
  p.pace = "MAX_GROWTH";
  const r = evaluateGrowthPolicy(p, {
    ...evidence,
    currentPolicyVersion: 2,
    trackingHealthy: false,
  });
  expect(r.blocked).toEqual(expect.arrayContaining(["STALE_POLICY", "TRACKING_UNVERIFIED"]));
  expect(r.allowed).toBe(false);
});
it("never treats absent CRM as healthy", () => {
  expect(
    evaluateGrowthPolicy(enabled(), { ...evidence, crmAgeHours: undefined }).blocked,
  ).toContain("CRM_STALE_OR_MISSING");
});
it("honors per-action permissions in autonomous mode", () => {
  const p = enabled();
  p.safetyPolicy.permissions.SCALE = "APPROVAL_REQUIRED";
  expect(evaluateGrowthPolicy(p, evidence).requiresApproval).toBe(true);
  p.safetyPolicy.permissions.SCALE = "DISABLED";
  expect(evaluateGrowthPolicy(p, evidence).blocked).toContain("ACTION_DISABLED");
});
it("blocks pausing final creative and publishing without simulation", () => {
  const p = enabled();
  expect(
    evaluateGrowthPolicy(p, { ...evidence, action: "PAUSE_CREATIVE", activeCreatives: 1 }).blocked,
  ).toContain("CREATIVE_CAPACITY");
  expect(
    evaluateGrowthPolicy(p, { ...evidence, action: "PUBLISH_CREATIVE", qaPassed: true }).blocked,
  ).toContain("SIMULATION_REQUIRED");
});
it("allows only bounded evidenced candidate, not an execution", () => {
  expect(evaluateGrowthPolicy(enabled(), evidence).allowed).toBe(true);
});
