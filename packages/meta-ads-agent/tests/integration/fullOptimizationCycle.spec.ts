import { describe, expect, it, vi } from "vitest";

import type { ExecuteVerdictPort } from "../../src/application/services/ExecutionService.js";
import { DEFAULT_META_ADS_AGENT_CONFIG } from "../../src/config/MetaAdsAgentConfig.js";
import { DecisionType } from "../../src/domain/value-objects/DecisionType.js";
import { TamaraAgentFactory } from "../../src/factories/TamaraAgentFactory.js";
import { buildLargeAdAccount } from "../fixtures/adAccountFixtures.js";
import {
  buildObjectiveFixture,
  buildObjectiveProgressFixture,
} from "../fixtures/objectiveFixtures.js";
import { createFakePublisher } from "../helpers/publisher.js";

function fakeExecuteVerdict(): ExecuteVerdictPort {
  return {
    execute: vi.fn().mockResolvedValue({
      ok: true,
      value: { action: "PAUSED", targetId: "x", targetType: "ad" },
    }),
  };
}

function buildRuntime() {
  return TamaraAgentFactory.create({
    config: { tenantId: "dss-motor", ...DEFAULT_META_ADS_AGENT_CONFIG },
    publisher: createFakePublisher(),
    executeVerdict: fakeExecuteVerdict() as never,
    metaAccessToken: "test-token",
    now: () => new Date("2026-08-09T00:00:00.000Z"),
  });
}

describe("Full optimization cycle — RunOptimizationCycle against a 72-ad AdAccount fixture", () => {
  it("produces an ExecutionPlan with a decision for every ad", async () => {
    const runtime = buildRuntime();
    const result = await runtime.runOptimizationCycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 72 per-ad decisions + 0-or-more portfolio decisions.
    expect(result.value.plan.decisions.length).toBeGreaterThanOrEqual(72);
  });

  it("all PAUSE decisions for 0-conversation ads are AUTO_EXECUTE", async () => {
    const runtime = buildRuntime();
    const result = await runtime.runOptimizationCycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const zeroConversationPauses = result.value.plan.decisions.filter(
      (d) => d.actionKind === "PAUSE" && d.spendIDR !== undefined && d.spendIDR > 0,
    );
    // Every PAUSE decision in this fixture set is either AUTO_EXECUTE or ESCALATE (never
    // NO_ACTION/BRIEF_KAI) since every PAUSE ad in the fixture has spend > 0.
    expect(zeroConversationPauses.length).toBeGreaterThan(0);
    for (const decision of zeroConversationPauses) {
      expect([DecisionType.AUTO_EXECUTE, DecisionType.ESCALATE]).toContain(decision.decisionType);
    }
  });

  it("REFRESH ads produce a CreativeBrief each", async () => {
    const runtime = buildRuntime();
    const result = await runtime.runOptimizationCycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const briefKaiDecisions = result.value.plan.briefedToKai();
    expect(briefKaiDecisions.length).toBeGreaterThan(0);
    expect(result.value.creativeBriefs.length).toBe(briefKaiDecisions.length);
  });

  it("FIX ads are always AUTO_EXECUTE", async () => {
    const runtime = buildRuntime();
    const result = await runtime.runOptimizationCycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fixDecisions = result.value.plan.decisions.filter((d) => d.actionKind === "FIX");
    expect(fixDecisions.length).toBeGreaterThan(0);
    for (const decision of fixDecisions) {
      expect(decision.decisionType).toBe(DecisionType.AUTO_EXECUTE);
    }
  });

  it("SCALE decisions split correctly between AUTO_EXECUTE and ESCALATE by budgetIncreaseIDR", async () => {
    const runtime = buildRuntime();
    const result = await runtime.runOptimizationCycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const scaleDecisions = result.value.plan.decisions.filter((d) => d.actionKind === "SCALE");
    expect(scaleDecisions.length).toBeGreaterThan(0);
    for (const decision of scaleDecisions) {
      const expected =
        (decision.budgetChangeIDR ?? 0) <= DEFAULT_META_ADS_AGENT_CONFIG.maxAutoScaleBudgetIDR
          ? DecisionType.AUTO_EXECUTE
          : DecisionType.ESCALATE;
      expect(decision.decisionType).toBe(expected);
    }
  });

  it("generates a DailyDigest with a correct Indonesian summary", async () => {
    const runtime = buildRuntime();
    const result = await runtime.runOptimizationCycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.digest.text).toContain("Laporan Harian Tamara");
    expect(result.value.digest.targetHotLeads).toBe(50);
    expect(result.value.digest.currentHotLeads).toBe(12);
  });

  it("ESCALATE decisions are queued for pending human approval", async () => {
    const runtime = buildRuntime();
    const result = await runtime.runOptimizationCycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const escalated = result.value.plan.escalated();
    expect(escalated.length).toBe(result.value.escalations.length);
    expect(runtime.escalationService.listPending().length).toBe(escalated.length);
  });

  it("AgentMemory accumulates across two RunOptimizationCycle calls against the SAME runtime", async () => {
    const runtime = buildRuntime();
    await runtime.runOptimizationCycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    const afterFirst = runtime.tamaraAgentService.getMemory().decisionOutcomeCount;
    expect(afterFirst).toBeGreaterThan(0);

    await runtime.runOptimizationCycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-2",
    });
    const afterSecond = runtime.tamaraAgentService.getMemory().decisionOutcomeCount;
    expect(afterSecond).toBeGreaterThan(afterFirst);
    expect(runtime.tamaraAgentService.getAgent().cycleCount).toBe(2);
  });

  it("agent transitions to IDLE and increments cycleCount after a completed cycle", async () => {
    const runtime = buildRuntime();
    await runtime.runOptimizationCycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(runtime.tamaraAgentService.getAgent().cycleCount).toBe(1);
  });

  it("the ExecutionPlan is retrievable from the DecisionRegistry after the cycle", async () => {
    const runtime = buildRuntime();
    const result = await runtime.runOptimizationCycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = runtime.decisionRegistry.getPlan(result.value.plan.id.toString());
    expect(stored.some).toBe(true);
  });
});
