import { describe, expect, it, vi } from "vitest";

import type { ExecuteVerdictPort } from "../../src/application/services/ExecutionService.js";
import { DEFAULT_META_ADS_AGENT_CONFIG } from "../../src/config/MetaAdsAgentConfig.js";
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
      value: { action: "SCALED", targetId: "x", targetType: "adset" },
    }),
  };
}

describe("Escalation -> human approval -> execution flow", () => {
  it("a human can approve an escalated decision, then execute it via ExecuteDecision", async () => {
    const runtime = TamaraAgentFactory.create({
      config: { tenantId: "dss-motor", ...DEFAULT_META_ADS_AGENT_CONFIG },
      publisher: createFakePublisher(),
      executeVerdict: fakeExecuteVerdict() as never,
      metaAccessToken: "test-token",
      now: () => new Date("2026-08-09T00:00:00.000Z"),
    });

    const cycleResult = await runtime.runOptimizationCycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(cycleResult.ok).toBe(true);
    if (!cycleResult.ok) return;

    const escalated = cycleResult.value.plan.escalated();
    expect(escalated.length).toBeGreaterThan(0);
    const targetDecision = escalated[0];
    expect(targetDecision).toBeDefined();
    if (!targetDecision) return;

    const approveResult = runtime.approveDecision.execute({
      decisionId: targetDecision.id.toString(),
      resolvedBy: "daffa@dssmotor.com",
    });
    expect(approveResult.ok).toBe(true);
    expect(approveResult.ok && approveResult.value.status).toBe("APPROVED");

    const executeResult = await runtime.executeDecision.execute({
      decision: targetDecision,
      tenantId: "dss-motor",
      correlationId: "corr-2",
    });
    expect(executeResult.ok).toBe(true);

    const statusResult = runtime.getAgentStatus.execute();
    expect(statusResult.ok).toBe(true);
    expect(statusResult.ok && statusResult.value.pendingEscalations.length).toBe(
      escalated.length - 1,
    );
  });

  it("a human can reject an escalated decision instead", async () => {
    const runtime = TamaraAgentFactory.create({
      config: { tenantId: "dss-motor", ...DEFAULT_META_ADS_AGENT_CONFIG },
      publisher: createFakePublisher(),
      executeVerdict: fakeExecuteVerdict() as never,
      metaAccessToken: "test-token",
      now: () => new Date("2026-08-09T00:00:00.000Z"),
    });

    const cycleResult = await runtime.runOptimizationCycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(cycleResult.ok).toBe(true);
    if (!cycleResult.ok) return;

    const targetDecision = cycleResult.value.plan.escalated()[0];
    expect(targetDecision).toBeDefined();
    if (!targetDecision) return;

    const rejectResult = runtime.rejectDecision.execute({
      decisionId: targetDecision.id.toString(),
      resolvedBy: "daffa@dssmotor.com",
    });
    expect(rejectResult.ok).toBe(true);
    expect(rejectResult.ok && rejectResult.value.status).toBe("REJECTED");
  });
});
