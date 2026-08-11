import { describe, expect, it } from "vitest";

import { ALL_PERSONA_IDS, PersonaId } from "../../../../src/domain/value-objects/PersonaId.js";

describe("PersonaId", () => {
  it("has exactly 10 members", () => {
    expect(Object.values(PersonaId)).toHaveLength(10);
  });

  it("ALL_PERSONA_IDS lists all 10 members exactly once", () => {
    expect(new Set(ALL_PERSONA_IDS).size).toBe(10);
    expect(ALL_PERSONA_IDS).toHaveLength(10);
  });

  it("uses the exact snake_case ids from the spec's Business correctness section", () => {
    expect(PersonaId.READY_BUYER).toBe("ready_buyer");
    expect(PersonaId.URGENT_BUYER).toBe("urgent_buyer");
    expect(PersonaId.GHOST_BUYER).toBe("ghost_buyer");
    expect(PersonaId.SYARIAH_BUYER).toBe("syariah_buyer");
  });

  it("every member's string value is lowercase snake_case", () => {
    for (const value of Object.values(PersonaId)) {
      expect(value).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });
});
