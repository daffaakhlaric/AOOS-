import { describe, expect, it } from "vitest";

import { ALL_PERSONA_IDS, PersonaId } from "../../../src/domain/value-objects/PersonaId.js";
import { PersonaRegistry } from "../../../src/registry/PersonaRegistry.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("PersonaRegistry", () => {
  it("creates successfully with all 10 personas registered", () => {
    const registry = unwrap(PersonaRegistry.create());
    expect(registry.list()).toHaveLength(10);
  });

  it("list() returns personas in the spec's canonical order", () => {
    const registry = unwrap(PersonaRegistry.create());
    expect(registry.list().map((p) => p.id)).toEqual(ALL_PERSONA_IDS);
  });

  it("get() returns the exact persona for a valid id", () => {
    const registry = unwrap(PersonaRegistry.create());
    const persona = unwrap(registry.get(PersonaId.READY_BUYER));
    expect(persona.id).toBe(PersonaId.READY_BUYER);
    expect(persona.name).toBe("Ready Buyer");
  });

  it("get() returns PersonaNotFoundError for an unregistered id", () => {
    const registry = unwrap(PersonaRegistry.create());
    const error = unwrapErr(registry.get("not_a_real_persona" as PersonaId));
    expect(error.message).toContain("not_a_real_persona");
  });

  it("every registered persona has a non-empty script and positive maxTurns", () => {
    const registry = unwrap(PersonaRegistry.create());
    for (const persona of registry.list()) {
      expect(persona.script.length).toBeGreaterThan(0);
      expect(persona.maxTurns).toBeGreaterThan(0);
    }
  });

  it("get() called twice for the same id returns equal persona data both times", () => {
    const registry = unwrap(PersonaRegistry.create());
    const first = unwrap(registry.get(PersonaId.URGENT_BUYER));
    const second = unwrap(registry.get(PersonaId.URGENT_BUYER));
    expect(first).toEqual(second);
  });

  it("difficulty distribution matches the spec: 3 EASY, 5 MEDIUM, 2 HARD", () => {
    const registry = unwrap(PersonaRegistry.create());
    const counts = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const persona of registry.list()) {
      counts[persona.difficulty] += 1;
    }
    expect(counts).toEqual({ EASY: 3, MEDIUM: 5, HARD: 2 });
  });
});
