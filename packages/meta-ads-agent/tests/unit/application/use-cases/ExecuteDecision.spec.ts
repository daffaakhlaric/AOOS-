import { Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import {
  ExecutionService,
  type ExecuteVerdictPort,
} from "../../../../src/application/services/ExecutionService.js";
import { ExecuteDecision } from "../../../../src/application/use-cases/ExecuteDecision.js";
import { CampaignDecision } from "../../../../src/domain/entities/CampaignDecision.js";
import { MetaAdsAgentEvents } from "../../../../src/domain/events/MetaAdsAgentEvents.js";
import { ConfidenceScore } from "../../../../src/domain/value-objects/ConfidenceScore.js";
import { DecisionId } from "../../../../src/domain/value-objects/DecisionId.js";
import { DecisionReason } from "../../../../src/domain/value-objects/DecisionReason.js";
import { DecisionType } from "../../../../src/domain/value-objects/DecisionType.js";
import { ImpactEstimate } from "../../../../src/domain/value-objects/ImpactEstimate.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap } from "../../../helpers/result.js";

describe("ExecuteDecision", () => {
  it("delegates to ExecutionService.execute", async () => {
    const executeVerdict: ExecuteVerdictPort = {
      execute: vi.fn().mockResolvedValue({
        ok: true,
        value: { action: "PAUSED", targetId: "ad-1", targetType: "ad" },
      }),
    };
    const publisher = createFakePublisher();
    const events = new MetaAdsAgentEvents(publisher);
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never;
    const executionService = new ExecutionService(executeVerdict, events, logger, "token");
    const useCase = new ExecuteDecision(executionService);

    const decision = unwrap(
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
      }),
    );

    const result = await useCase.execute({
      decision,
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
    expect(executeVerdict.execute).toHaveBeenCalledTimes(1);
  });
});
