import { describe, expect, it } from "vitest";

import { EscalationService } from "../../../../src/application/services/EscalationService.js";
import { CampaignDecision } from "../../../../src/domain/entities/CampaignDecision.js";
import { EscalationRequest } from "../../../../src/domain/entities/EscalationRequest.js";
import { ConfidenceScore } from "../../../../src/domain/value-objects/ConfidenceScore.js";
import { DecisionId } from "../../../../src/domain/value-objects/DecisionId.js";
import { DecisionReason } from "../../../../src/domain/value-objects/DecisionReason.js";
import { DecisionType } from "../../../../src/domain/value-objects/DecisionType.js";
import { ImpactEstimate } from "../../../../src/domain/value-objects/ImpactEstimate.js";
import { unwrap } from "../../../helpers/result.js";

function makeRequest() {
  const decision = unwrap(
    CampaignDecision.create({
      id: DecisionId.generate(),
      targetId: "realloc:1",
      targetType: "portfolio",
      actionKind: "REALLOCATE_BUDGET",
      decisionType: DecisionType.ESCALATE,
      reason: unwrap(DecisionReason.create("large realloc")),
      confidence: unwrap(ConfidenceScore.create(80)),
      impact: unwrap(ImpactEstimate.create({ description: "x" })),
      createdAt: new Date(),
    }),
  );
  return unwrap(
    EscalationRequest.create({
      id: decision.id,
      decision,
      status: "PENDING",
      createdAt: new Date(),
    }),
  );
}

describe("EscalationService", () => {
  it("enqueue + listPending surfaces the pending request", () => {
    const service = new EscalationService();
    const request = makeRequest();
    service.enqueue(request);
    expect(service.listPending()).toHaveLength(1);
    expect(service.listPending()[0]?.id.toString()).toBe(request.id.toString());
  });

  it("approve() resolves a pending request and removes it from listPending", () => {
    const service = new EscalationService();
    const request = makeRequest();
    service.enqueue(request);
    const result = service.approve(request.decision.id.toString(), new Date(), "daffa");
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.status).toBe("APPROVED");
    expect(service.listPending()).toHaveLength(0);
  });

  it("reject() resolves a pending request as REJECTED", () => {
    const service = new EscalationService();
    const request = makeRequest();
    service.enqueue(request);
    const result = service.reject(request.decision.id.toString(), new Date(), "daffa");
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.status).toBe("REJECTED");
  });

  it("approve() fails with EscalationError for an unknown decisionId", () => {
    const service = new EscalationService();
    const result = service.approve("unknown", new Date(), "daffa");
    expect(result.ok).toBe(false);
  });

  it("reject() fails with EscalationError for an unknown decisionId", () => {
    const service = new EscalationService();
    const result = service.reject("unknown", new Date(), "daffa");
    expect(result.ok).toBe(false);
  });

  it("approve() fails when the request is already resolved", () => {
    const service = new EscalationService();
    const request = makeRequest();
    service.enqueue(request);
    service.approve(request.decision.id.toString(), new Date(), "daffa");
    const second = service.approve(request.decision.id.toString(), new Date(), "daffa");
    expect(second.ok).toBe(false);
  });

  it("reject() fails when the request is already resolved", () => {
    const service = new EscalationService();
    const request = makeRequest();
    service.enqueue(request);
    service.reject(request.decision.id.toString(), new Date(), "daffa");
    const second = service.reject(request.decision.id.toString(), new Date(), "daffa");
    expect(second.ok).toBe(false);
  });

  it("listAll returns every request regardless of status", () => {
    const service = new EscalationService();
    const request = makeRequest();
    service.enqueue(request);
    service.approve(request.decision.id.toString(), new Date(), "daffa");
    expect(service.listAll()).toHaveLength(1);
  });

  it("get() returns the current stored request by decisionId", () => {
    const service = new EscalationService();
    const request = makeRequest();
    service.enqueue(request);
    expect(service.get(request.decision.id.toString())?.status).toBe("PENDING");
    expect(service.get("unknown")).toBeUndefined();
  });
});
