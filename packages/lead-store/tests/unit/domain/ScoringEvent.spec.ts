import { describe, expect, it } from "vitest";

import { ScoringEvent } from "../../../src/domain/entities/ScoringEvent.js";
import { LeadId } from "../../../src/domain/value-objects/LeadId.js";
import { ScoreReason } from "../../../src/domain/value-objects/ScoreReason.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const NOW = new Date("2026-01-15T09:00:00.000Z");

function baseProps() {
  return {
    id: "score-1",
    leadId: LeadId.generate(),
    scoreBefore: 0,
    scoreAfter: 25,
    delta: 25,
    reason: ScoreReason.BUDGET,
    createdAt: NOW,
  };
}

describe("ScoringEvent entity", () => {
  it("creates a valid scoring event", () => {
    const event = unwrap(ScoringEvent.create(baseProps()));
    expect(event.scoreBefore).toBe(0);
    expect(event.scoreAfter).toBe(25);
    expect(event.delta).toBe(25);
    expect(event.reason).toBe(ScoreReason.BUDGET);
  });

  it("rejects scoreAfter below 0", () => {
    const error = unwrapErr(ScoringEvent.create({ ...baseProps(), scoreAfter: -1 }));
    expect(error.message).toContain("scoreAfter");
  });

  it("rejects scoreAfter above 100", () => {
    const error = unwrapErr(ScoringEvent.create({ ...baseProps(), scoreAfter: 101 }));
    expect(error.message).toContain("scoreAfter");
  });

  it("rejects scoreBefore below 0", () => {
    const error = unwrapErr(ScoringEvent.create({ ...baseProps(), scoreBefore: -5 }));
    expect(error.message).toContain("scoreBefore");
  });

  it("rejects scoreBefore above 100", () => {
    const error = unwrapErr(ScoringEvent.create({ ...baseProps(), scoreBefore: 105 }));
    expect(error.message).toContain("scoreBefore");
  });

  it("accepts a negative delta (score decrease)", () => {
    const event = unwrap(
      ScoringEvent.create({
        ...baseProps(),
        scoreBefore: 100,
        scoreAfter: 80,
        delta: -20,
        reason: ScoreReason.NOT_SERIOUS,
      }),
    );
    expect(event.delta).toBe(-20);
  });

  it("exposes triggeredBy when provided", () => {
    const event = unwrap(ScoringEvent.create({ ...baseProps(), triggeredBy: "msg-1" }));
    expect(event.triggeredBy).toBe("msg-1");
  });

  it("leaves triggeredBy undefined when omitted", () => {
    const event = unwrap(ScoringEvent.create(baseProps()));
    expect(event.triggeredBy).toBeUndefined();
  });
});
