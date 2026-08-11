import { err, ok } from "@aos/common";
import { Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import { DecisionEngineService } from "../../../../src/application/services/DecisionEngineService.js";
import { EscalationService } from "../../../../src/application/services/EscalationService.js";
import { TamaraAgentService } from "../../../../src/application/services/TamaraAgentService.js";
import { GenerateCreativeBrief } from "../../../../src/application/use-cases/GenerateCreativeBrief.js";
import { RunOptimizationCycle } from "../../../../src/application/use-cases/RunOptimizationCycle.js";
import { DEFAULT_META_ADS_AGENT_CONFIG } from "../../../../src/config/MetaAdsAgentConfig.js";
import { CampaignDecision } from "../../../../src/domain/entities/CampaignDecision.js";
import { CreativeBrief } from "../../../../src/domain/entities/CreativeBrief.js";
import { DecisionError } from "../../../../src/domain/errors/index.js";
import { MetaAdsAgentEvents } from "../../../../src/domain/events/MetaAdsAgentEvents.js";
import { ConfidenceScore } from "../../../../src/domain/value-objects/ConfidenceScore.js";
import { CreativeBriefId } from "../../../../src/domain/value-objects/CreativeBriefId.js";
import { DecisionId } from "../../../../src/domain/value-objects/DecisionId.js";
import { DecisionReason } from "../../../../src/domain/value-objects/DecisionReason.js";
import { DecisionType } from "../../../../src/domain/value-objects/DecisionType.js";
import { ImpactEstimate } from "../../../../src/domain/value-objects/ImpactEstimate.js";
import { VerdictDecisionEngine } from "../../../../src/intelligence/VerdictDecisionEngine.js";
import { AgentRegistry } from "../../../../src/registry/AgentRegistry.js";
import { DecisionRegistry } from "../../../../src/registry/DecisionRegistry.js";
import { buildLargeAdAccount } from "../../../fixtures/adAccountFixtures.js";
import {
  buildObjectiveFixture,
  buildObjectiveProgressFixture,
} from "../../../fixtures/objectiveFixtures.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

const now = () => new Date("2026-08-09T00:00:00.000Z");
const config = { tenantId: "dss-motor", ...DEFAULT_META_ADS_AGENT_CONFIG };

function fakeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never;
}

function decisionOf(overrides: Partial<Parameters<typeof CampaignDecision.create>[0]> = {}) {
  return unwrap(
    CampaignDecision.create({
      id: DecisionId.generate(),
      targetId: "ad-1",
      targetType: "ad",
      actionKind: "REFRESH",
      decisionType: DecisionType.BRIEF_KAI,
      verdict: Verdict.REFRESH,
      reason: unwrap(DecisionReason.create("refresh")),
      confidence: unwrap(ConfidenceScore.create(90)),
      impact: unwrap(ImpactEstimate.create({ description: "brief" })),
      createdAt: now(),
      ...overrides,
    }),
  );
}

function buildCycle(overrides: {
  pipeline?: { analyze: (a: unknown) => unknown };
  decisionEngine?: { decideAll: (a: unknown, b: unknown) => unknown };
  executionService?: { execute: (...args: unknown[]) => unknown };
  generateCreativeBrief?: { execute: (...args: unknown[]) => unknown };
}) {
  const publisher = createFakePublisher();
  const events = new MetaAdsAgentEvents(publisher);
  const agentRegistry = new AgentRegistry();
  const decisionRegistry = new DecisionRegistry();
  const agentService = new TamaraAgentService("dss-motor", agentRegistry, decisionRegistry, now);
  const escalationService = new EscalationService();
  const decisionEngine =
    overrides.decisionEngine ?? new DecisionEngineService(new VerdictDecisionEngine(now), now);
  const executionService = overrides.executionService ?? {
    execute: vi.fn().mockResolvedValue(ok(undefined)),
  };
  const generateCreativeBrief =
    overrides.generateCreativeBrief ??
    new GenerateCreativeBrief({ generate: () => err(new DecisionError("boom")) }, events);

  const cycle = new RunOptimizationCycle(
    overrides.pipeline as never,
    decisionEngine as never,
    executionService as never,
    escalationService,
    generateCreativeBrief as never,
    agentService,
    decisionRegistry,
    events,
    config,
    fakeLogger(),
    createFakeTracer(),
    now,
  );
  return { cycle, publisher, agentService, escalationService, decisionRegistry };
}

describe("RunOptimizationCycle — construction", () => {
  it("uses the real wall clock when no clock is injected", async () => {
    const publisher = createFakePublisher();
    const events = new MetaAdsAgentEvents(publisher);
    const agentService = new TamaraAgentService(
      "dss-motor",
      new AgentRegistry(),
      new DecisionRegistry(),
    );
    const escalationService = new EscalationService();
    const decisionEngine = new DecisionEngineService(new VerdictDecisionEngine());
    const executionService = { execute: vi.fn().mockResolvedValue(ok(undefined)) };
    const generateCreativeBrief = new GenerateCreativeBrief(
      { generate: () => err(new DecisionError("boom")) },
      events,
    );
    const cycle = new RunOptimizationCycle(
      {
        analyze: () =>
          ok({ adFindings: [], portfolioFindings: [], avgRphChatIDR: 0, dataCoverageFraction: 0 }),
      } as never,
      decisionEngine,
      executionService as never,
      escalationService,
      generateCreativeBrief,
      agentService,
      new DecisionRegistry(),
      events,
      config,
      fakeLogger(),
      createFakeTracer(),
    );
    const result = await cycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
  });
});

describe("RunOptimizationCycle — error branches", () => {
  it("returns AgentError when the pipeline fails to analyze", async () => {
    const { cycle } = buildCycle({
      pipeline: { analyze: () => err(new DecisionError("bad account")) },
    });
    const result = await cycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(false);
  });

  it("returns AgentError when the decision engine fails", async () => {
    const { cycle } = buildCycle({
      pipeline: {
        analyze: () =>
          ok({ adFindings: [], portfolioFindings: [], avgRphChatIDR: 0, dataCoverageFraction: 0 }),
      },
      decisionEngine: { decideAll: () => err(new DecisionError("bad decision")) },
    });
    const result = await cycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(false);
  });

  it("returns AgentError when ExecutionPlanBuilder.build fails (empty tenantId)", async () => {
    const { cycle } = buildCycle({
      pipeline: {
        analyze: () =>
          ok({ adFindings: [], portfolioFindings: [], avgRphChatIDR: 0, dataCoverageFraction: 0 }),
      },
      decisionEngine: { decideAll: () => ok([]) },
    });
    const result = await cycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(false);
  });

  it("skips a BRIEF_KAI decision whose targetId matches no ad in the account", async () => {
    const { cycle } = buildCycle({
      pipeline: {
        analyze: () =>
          ok({ adFindings: [], portfolioFindings: [], avgRphChatIDR: 0, dataCoverageFraction: 0 }),
      },
      decisionEngine: { decideAll: () => ok([decisionOf({ targetId: "no-such-ad" })]) },
    });
    const result = await cycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.creativeBriefs).toHaveLength(0);
  });

  it("continues (without adding a brief) when GenerateCreativeBrief fails for a matched ad", async () => {
    const account = buildLargeAdAccount();
    const someAdId = account.campaigns[0]?.adSets[0]?.ads[0]?.id.toString() ?? "";
    const { cycle } = buildCycle({
      pipeline: {
        analyze: () =>
          ok({ adFindings: [], portfolioFindings: [], avgRphChatIDR: 0, dataCoverageFraction: 0 }),
      },
      decisionEngine: { decideAll: () => ok([decisionOf({ targetId: someAdId })]) },
      generateCreativeBrief: {
        execute: vi.fn().mockResolvedValue(err(new DecisionError("boom"))),
      },
    });
    const result = await cycle.execute({
      adAccount: account,
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.creativeBriefs).toHaveLength(0);
  });

  it("records angle performance with avgRphD3IDR = 0 when the matched ad has an undefined rphD3", async () => {
    const account = buildLargeAdAccount();
    const zeroD3Ad = account.campaigns[0]?.adSets[0]?.ads[0];
    const someAdId = zeroD3Ad?.id.toString() ?? "";
    expect(zeroD3Ad?.metrics.rphD3.isDefined()).toBe(false);
    const brief = unwrap(
      CreativeBrief.create({
        id: CreativeBriefId.generate(),
        adId: someAdId,
        unit: "Xpander",
        branch: zeroD3Ad?.branch ?? ("BINTARO" as never),
        angle: "DP_RINGAN" as never,
        targetPersona: "PRIMARY_FAMILY" as never,
        primaryMessage: "x",
        tone: "casual",
        avoid: [],
        formats: ["VIDEO_15S"],
        reason: "x",
        urgency: "HIGH",
        estimatedImpactIfRefreshed: "x",
        createdAt: now(),
      }),
    );
    const { cycle, agentService } = buildCycle({
      pipeline: {
        analyze: () =>
          ok({ adFindings: [], portfolioFindings: [], avgRphChatIDR: 0, dataCoverageFraction: 0 }),
      },
      decisionEngine: { decideAll: () => ok([decisionOf({ targetId: someAdId })]) },
      generateCreativeBrief: { execute: vi.fn().mockResolvedValue(ok(brief)) },
    });
    const result = await cycle.execute({
      adAccount: account,
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
    const recorded = [...agentService.getMemory().anglePerformance.values()][0];
    expect(recorded?.avgRphD3IDR).toBe(0);
  });

  it("logs a warning (and continues) when an AUTO_EXECUTE decision fails to execute", async () => {
    const { cycle } = buildCycle({
      pipeline: {
        analyze: () =>
          ok({ adFindings: [], portfolioFindings: [], avgRphChatIDR: 0, dataCoverageFraction: 0 }),
      },
      decisionEngine: {
        decideAll: () =>
          ok([
            decisionOf({
              actionKind: "PAUSE",
              decisionType: DecisionType.AUTO_EXECUTE,
              targetType: "ad",
            }),
          ]),
      },
      executionService: { execute: vi.fn().mockResolvedValue(err(new DecisionError("meta down"))) },
    });
    const result = await cycle.execute({
      adAccount: buildLargeAdAccount(),
      objective: buildObjectiveFixture(),
      progress: buildObjectiveProgressFixture(),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
  });
});
