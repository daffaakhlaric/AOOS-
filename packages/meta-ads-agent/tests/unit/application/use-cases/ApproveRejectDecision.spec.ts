import { describe, expect, it, vi } from "vitest";

import { EscalationService } from "../../../../src/application/services/EscalationService.js";
import { ApproveDecision } from "../../../../src/application/use-cases/ApproveDecision.js";
import { RejectDecision } from "../../../../src/application/use-cases/RejectDecision.js";
import { AgentMemory } from "../../../../src/domain/entities/AgentMemory.js";
import { CampaignDecision } from "../../../../src/domain/entities/CampaignDecision.js";
import { EscalationRequest } from "../../../../src/domain/entities/EscalationRequest.js";
import { ConfidenceScore } from "../../../../src/domain/value-objects/ConfidenceScore.js";
import { DecisionId } from "../../../../src/domain/value-objects/DecisionId.js";
import { DecisionReason } from "../../../../src/domain/value-objects/DecisionReason.js";
import { DecisionType } from "../../../../src/domain/value-objects/DecisionType.js";
import { ImpactEstimate } from "../../../../src/domain/value-objects/ImpactEstimate.js";
import { unwrap } from "../../../helpers/result.js";

function fakeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never;
}

function requestFor(service: EscalationService) {
  const decision = unwrap(
    CampaignDecision.create({
      id: DecisionId.generate(),
      targetId: "realloc:1",
      targetType: "portfolio",
      actionKind: "REALLOCATE_BUDGET",
      decisionType: DecisionType.ESCALATE,
      reason: unwrap(DecisionReason.create("x")),
      confidence: unwrap(ConfidenceScore.create(80)),
      impact: unwrap(ImpactEstimate.create({ description: "x" })),
      createdAt: new Date(),
    }),
  );
  const request = unwrap(
    EscalationRequest.create({
      id: decision.id,
      decision,
      status: "PENDING",
      createdAt: new Date(),
    }),
  );
  service.enqueue(request);
  return request;
}

describe("ApproveDecision", () => {
  it("approves a pending escalation and records the outcome in memory", () => {
    const escalationService = new EscalationService();
    const memory = new AgentMemory();
    const request = requestFor(escalationService);
    const useCase = new ApproveDecision(escalationService, memory, fakeLogger(), () => new Date());

    const result = useCase.execute({
      decisionId: request.decision.id.toString(),
      resolvedBy: "daffa",
    });
    expect(result.ok).toBe(true);
    expect(memory.escalationOutcomes.get(request.decision.id.toString())).toBe("APPROVED");
  });

  it("returns an error for an unknown decisionId", () => {
    const useCase = new ApproveDecision(new EscalationService(), new AgentMemory(), fakeLogger());
    const result = useCase.execute({ decisionId: "unknown", resolvedBy: "daffa" });
    expect(result.ok).toBe(false);
  });
});

describe("RejectDecision", () => {
  it("rejects a pending escalation and records the outcome in memory", () => {
    const escalationService = new EscalationService();
    const memory = new AgentMemory();
    const request = requestFor(escalationService);
    const useCase = new RejectDecision(escalationService, memory, fakeLogger(), () => new Date());

    const result = useCase.execute({
      decisionId: request.decision.id.toString(),
      resolvedBy: "daffa",
    });
    expect(result.ok).toBe(true);
    expect(memory.escalationOutcomes.get(request.decision.id.toString())).toBe("REJECTED");
  });

  it("returns an error for an unknown decisionId", () => {
    const useCase = new RejectDecision(new EscalationService(), new AgentMemory(), fakeLogger());
    const result = useCase.execute({ decisionId: "unknown", resolvedBy: "daffa" });
    expect(result.ok).toBe(false);
  });
});
