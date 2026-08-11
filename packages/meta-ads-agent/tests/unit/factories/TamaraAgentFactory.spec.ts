import { describe, expect, it, vi } from "vitest";

import type { ExecuteVerdictPort } from "../../../src/application/services/ExecutionService.js";
import { DEFAULT_META_ADS_AGENT_CONFIG } from "../../../src/config/MetaAdsAgentConfig.js";
import { TamaraAgentFactory } from "../../../src/factories/TamaraAgentFactory.js";
import { buildLargeAdAccount } from "../../fixtures/adAccountFixtures.js";
import {
  buildObjectiveFixture,
  buildObjectiveProgressFixture,
} from "../../fixtures/objectiveFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";

function fakeExecuteVerdict(): ExecuteVerdictPort {
  return {
    execute: vi.fn().mockResolvedValue({
      ok: true,
      value: { action: "PAUSED", targetId: "ad-1", targetType: "ad" },
    }),
  };
}

describe("TamaraAgentFactory.create", () => {
  it("wires up every use case and service", () => {
    const runtime = TamaraAgentFactory.create({
      config: { tenantId: "dss-motor", ...DEFAULT_META_ADS_AGENT_CONFIG },
      publisher: createFakePublisher(),
      executeVerdict: fakeExecuteVerdict() as never,
      metaAccessToken: "token",
    });

    expect(runtime.runOptimizationCycle).toBeDefined();
    expect(runtime.executeDecision).toBeDefined();
    expect(runtime.generateCreativeBrief).toBeDefined();
    expect(runtime.generateDailyDigest).toBeDefined();
    expect(runtime.approveDecision).toBeDefined();
    expect(runtime.rejectDecision).toBeDefined();
    expect(runtime.getAgentStatus).toBeDefined();
    expect(runtime.tamaraAgentService).toBeDefined();
    expect(runtime.decisionEngineService).toBeDefined();
    expect(runtime.escalationService).toBeDefined();
    expect(runtime.agentRegistry).toBeDefined();
    expect(runtime.decisionRegistry).toBeDefined();
  });

  it("resets AgentMemory fresh on every create() call", () => {
    const options = {
      config: { tenantId: "dss-motor", ...DEFAULT_META_ADS_AGENT_CONFIG },
      publisher: createFakePublisher(),
      executeVerdict: fakeExecuteVerdict() as never,
      metaAccessToken: "token",
    };
    const first = TamaraAgentFactory.create(options);
    first.tamaraAgentService.getMemory().recordEscalationOutcome("d1", "APPROVED");

    const second = TamaraAgentFactory.create(options);
    expect(second.tamaraAgentService.getMemory().escalationOutcomes.size).toBe(0);
  });

  it("uses a default logger/tracer/clock when none are supplied", () => {
    const runtime = TamaraAgentFactory.create({
      config: { tenantId: "dss-motor", ...DEFAULT_META_ADS_AGENT_CONFIG },
      publisher: createFakePublisher(),
      executeVerdict: fakeExecuteVerdict() as never,
      metaAccessToken: "token",
    });
    expect(runtime.tamaraAgentService.getAgent().createdAt).toBeInstanceOf(Date);
  });

  it("runs a full optimization cycle using the real wall clock end to end", async () => {
    const runtime = TamaraAgentFactory.create({
      config: { tenantId: "dss-motor", ...DEFAULT_META_ADS_AGENT_CONFIG },
      publisher: createFakePublisher(),
      executeVerdict: fakeExecuteVerdict() as never,
      metaAccessToken: "token",
    });
    const result = await runtime.runOptimizationCycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
  });
});
