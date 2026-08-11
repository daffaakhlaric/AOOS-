import { describe, expect, it } from "vitest";

import { CampaignDecision } from "../../../../src/domain/entities/CampaignDecision.js";
import { EscalationRequest } from "../../../../src/domain/entities/EscalationRequest.js";
import { ConfidenceScore } from "../../../../src/domain/value-objects/ConfidenceScore.js";
import { DecisionId } from "../../../../src/domain/value-objects/DecisionId.js";
import { DecisionReason } from "../../../../src/domain/value-objects/DecisionReason.js";
import { DecisionType } from "../../../../src/domain/value-objects/DecisionType.js";
import { ImpactEstimate } from "../../../../src/domain/value-objects/ImpactEstimate.js";
import { unwrap } from "../../../helpers/result.js";

function decision(): CampaignDecision {
  return unwrap(
    CampaignDecision.create({
      id: DecisionId.generate(),
      targetId: "t",
      targetType: "ad",
      actionKind: "PAUSE",
      decisionType: DecisionType.ESCALATE,
      reason: unwrap(DecisionReason.create("high spend")),
      confidence: unwrap(ConfidenceScore.create(80)),
      impact: unwrap(ImpactEstimate.create({ description: "d" })),
      createdAt: new Date("2026-08-09T00:00:00.000Z"),
    }),
  );
}

describe("EscalationRequest", () => {
  it("creates a PENDING request", () => {
    const result = EscalationRequest.create({
      id: DecisionId.generate(),
      decision: decision(),
      status: "PENDING",
      createdAt: new Date(),
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.isPending()).toBe(true);
  });

  it("rejects an invalid status", () => {
    const result = EscalationRequest.create({
      id: DecisionId.generate(),
      decision: decision(),
      status: "BOGUS" as never,
      createdAt: new Date(),
    });
    expect(result.ok).toBe(false);
  });

  it("approve() returns a new APPROVED request, not mutating the original", () => {
    const original = unwrap(
      EscalationRequest.create({
        id: DecisionId.generate(),
        decision: decision(),
        status: "PENDING",
        createdAt: new Date(),
      }),
    );
    const approved = original.approve(new Date("2026-08-10T00:00:00.000Z"), "daffa");
    expect(original.status).toBe("PENDING");
    expect(approved.status).toBe("APPROVED");
    expect(approved.resolvedBy).toBe("daffa");
    expect(approved.resolvedAt).toEqual(new Date("2026-08-10T00:00:00.000Z"));
    expect(approved.isPending()).toBe(false);
  });

  it("reject() returns a new REJECTED request, not mutating the original", () => {
    const original = unwrap(
      EscalationRequest.create({
        id: DecisionId.generate(),
        decision: decision(),
        status: "PENDING",
        createdAt: new Date(),
      }),
    );
    const rejected = original.reject(new Date("2026-08-10T00:00:00.000Z"), "daffa");
    expect(original.status).toBe("PENDING");
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.isPending()).toBe(false);
  });

  it("exposes the underlying decision, id, and createdAt", () => {
    const d = decision();
    const createdAt = new Date("2026-08-09T00:00:00.000Z");
    const request = unwrap(
      EscalationRequest.create({ id: d.id, decision: d, status: "PENDING", createdAt }),
    );
    expect(request.decision).toBe(d);
    expect(request.id).toBe(d.id);
    expect(request.createdAt).toEqual(createdAt);
  });
});
