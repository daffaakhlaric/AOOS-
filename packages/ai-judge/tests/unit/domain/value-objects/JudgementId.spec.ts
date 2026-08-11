import { beforeEach, describe, expect, it } from "vitest";

import {
  JudgementId,
  resetJudgementIdSequence,
} from "../../../../src/domain/value-objects/JudgementId.js";

describe("JudgementId", () => {
  beforeEach(() => {
    resetJudgementIdSequence();
  });

  it("generate() produces a deterministic id given sessionId + now + sequence", () => {
    const now = new Date(2026, 0, 1, 0, 0, 0);
    const id = JudgementId.generate("sim-1", now);
    expect(id.toString()).toBe(`judgement-sim-1-${now.getTime()}-1`);
  });

  it("generate() increments the sequence on each call", () => {
    const now = new Date(2026, 0, 1, 0, 0, 0);
    const first = JudgementId.generate("sim-1", now);
    const second = JudgementId.generate("sim-1", now);
    expect(first.toString()).not.toBe(second.toString());
  });

  it("create() wraps a raw string as-is", () => {
    expect(JudgementId.create("custom-id").toString()).toBe("custom-id");
  });

  it("equals() compares by string value", () => {
    const a = JudgementId.create("same");
    const b = JudgementId.create("same");
    const c = JudgementId.create("different");
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it("resetJudgementIdSequence() resets the counter for deterministic tests", () => {
    const now = new Date(2026, 0, 1, 0, 0, 0);
    JudgementId.generate("sim-1", now);
    resetJudgementIdSequence();
    const id = JudgementId.generate("sim-1", now);
    expect(id.toString()).toBe(`judgement-sim-1-${now.getTime()}-1`);
  });
});
