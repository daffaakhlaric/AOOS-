import { describe, expect, it } from "vitest";

import { PersonaId } from "../../../../src/domain/value-objects/PersonaId.js";
import {
  resetSessionIdSequence,
  SessionId,
} from "../../../../src/domain/value-objects/SessionId.js";

describe("SessionId", () => {
  it("generate() embeds the persona id and timestamp in the string", () => {
    const now = new Date("2026-08-10T09:00:00.000Z");
    const id = SessionId.generate(PersonaId.READY_BUYER, now);
    expect(id.toString()).toContain("ready_buyer");
    expect(id.toString()).toContain(String(now.getTime()));
  });

  it("generate() never produces two equal ids, even for the same (personaId, now) pair", () => {
    resetSessionIdSequence();
    const now = new Date("2026-08-10T09:00:00.000Z");
    const first = SessionId.generate(PersonaId.COLD_BUYER, now);
    const second = SessionId.generate(PersonaId.COLD_BUYER, now);
    expect(first.equals(second)).toBe(false);
  });

  it("create() builds from a raw string and equals() compares by value", () => {
    const a = SessionId.create("sim-x-1");
    const b = SessionId.create("sim-x-1");
    const c = SessionId.create("sim-x-2");
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    expect(a.toString()).toBe("sim-x-1");
  });

  it("resetSessionIdSequence() resets the monotonic counter deterministically", () => {
    resetSessionIdSequence();
    const now = new Date("2026-08-10T09:00:00.000Z");
    const before = SessionId.generate(PersonaId.COLD_BUYER, now).toString();
    resetSessionIdSequence();
    const after = SessionId.generate(PersonaId.COLD_BUYER, now).toString();
    expect(before).toBe(after);
  });
});
