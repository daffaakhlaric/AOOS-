import { Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import type { ExecuteVerdictPort } from "../../../../src/application/services/ExecutionService.js";
import { ExecutionService } from "../../../../src/application/services/ExecutionService.js";
import { CampaignDecision } from "../../../../src/domain/entities/CampaignDecision.js";
import { MetaAdsAgentEvents } from "../../../../src/domain/events/MetaAdsAgentEvents.js";
import { ConfidenceScore } from "../../../../src/domain/value-objects/ConfidenceScore.js";
import { DecisionId } from "../../../../src/domain/value-objects/DecisionId.js";
import { DecisionReason } from "../../../../src/domain/value-objects/DecisionReason.js";
import { DecisionType } from "../../../../src/domain/value-objects/DecisionType.js";
import { ImpactEstimate } from "../../../../src/domain/value-objects/ImpactEstimate.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap } from "../../../helpers/result.js";

function decision(overrides: Partial<Parameters<typeof CampaignDecision.create>[0]> = {}) {
  return unwrap(
    CampaignDecision.create({
      id: DecisionId.generate(),
      targetId: "ad-1",
      targetType: "ad",
      actionKind: "PAUSE",
      decisionType: DecisionType.AUTO_EXECUTE,
      verdict: Verdict.PAUSE,
      reason: unwrap(DecisionReason.create("boros")),
      confidence: unwrap(ConfidenceScore.create(90)),
      impact: unwrap(ImpactEstimate.create({ description: "hemat" })),
      createdAt: new Date(),
      ...overrides,
    }),
  );
}

function fakeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never;
}

describe("ExecutionService.execute", () => {
  it("delegates ad/adset/campaign decisions to ExecuteVerdict and publishes DecisionExecuted", async () => {
    const executeVerdict: ExecuteVerdictPort = {
      execute: vi.fn().mockResolvedValue({
        ok: true,
        value: { action: "PAUSED", targetId: "ad-1", targetType: "ad" },
      }),
    };
    const publisher = createFakePublisher();
    const events = new MetaAdsAgentEvents(publisher);
    const service = new ExecutionService(executeVerdict, events, fakeLogger(), "token-123");

    const result = await service.execute(decision(), "dss-motor", "corr-1");
    expect(result.ok).toBe(true);
    expect(executeVerdict.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        verdict: Verdict.PAUSE,
        targetId: "ad-1",
        accessToken: "token-123",
      }),
    );
    expect(publisher.published.some((p) => p.type === "aaos.samantha.decision.executed")).toBe(
      true,
    );
  });

  it("returns ExecutionError when ExecuteVerdict fails", async () => {
    const executeVerdict: ExecuteVerdictPort = {
      execute: vi.fn().mockResolvedValue({ ok: false, error: { message: "meta api down" } }),
    };
    const publisher = createFakePublisher();
    const events = new MetaAdsAgentEvents(publisher);
    const service = new ExecutionService(executeVerdict, events, fakeLogger(), "token-123");

    const result = await service.execute(decision(), "dss-motor", "corr-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("meta api down");
    }
  });

  it("portfolio decisions bypass ExecuteVerdict entirely and publish DecisionExecuted directly", async () => {
    const executeVerdict: ExecuteVerdictPort = { execute: vi.fn() };
    const publisher = createFakePublisher();
    const events = new MetaAdsAgentEvents(publisher);
    const service = new ExecutionService(executeVerdict, events, fakeLogger(), "token-123");

    const portfolioDecision = decision({
      targetId: "realloc:1",
      targetType: "portfolio",
      actionKind: "REALLOCATE_BUDGET",
      verdict: undefined,
    });
    const result = await service.execute(portfolioDecision, "dss-motor", "corr-1");
    expect(result.ok).toBe(true);
    expect(executeVerdict.execute).not.toHaveBeenCalled();
    expect(publisher.published.some((p) => p.type === "aaos.samantha.decision.executed")).toBe(
      true,
    );
  });

  it("returns ExecutionError when a non-portfolio decision has no Verdict", async () => {
    const executeVerdict: ExecuteVerdictPort = { execute: vi.fn() };
    const publisher = createFakePublisher();
    const events = new MetaAdsAgentEvents(publisher);
    const service = new ExecutionService(executeVerdict, events, fakeLogger(), "token-123");

    const brokenDecision = decision({ verdict: undefined });
    const result = await service.execute(brokenDecision, "dss-motor", "corr-1");
    expect(result.ok).toBe(false);
  });
});
