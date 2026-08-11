import { describe, expect, it } from "vitest";

import { SimulationSessionBuilder } from "../../../src/builders/SimulationSessionBuilder.js";
import { PersonaDifficulty } from "../../../src/domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../../../src/domain/value-objects/PersonaId.js";
import { SimulationStatus } from "../../../src/domain/value-objects/SimulationStatus.js";

describe("SimulationSessionBuilder", () => {
  it("start() builds a fresh RUNNING session for the given persona", () => {
    const now = new Date("2026-08-10T09:00:00.000Z");
    const session = SimulationSessionBuilder.start(
      PersonaId.READY_BUYER,
      PersonaDifficulty.EASY,
      now,
    );
    expect(session.personaId).toBe(PersonaId.READY_BUYER);
    expect(session.personaDifficulty).toBe(PersonaDifficulty.EASY);
    expect(session.status).toBe(SimulationStatus.RUNNING);
    expect(session.startedAtMs).toBe(now.getTime());
    expect(session.id.toString()).toContain("ready_buyer");
  });

  it("start() generates a distinct session id on each call", () => {
    const now = new Date("2026-08-10T09:00:00.000Z");
    const first = SimulationSessionBuilder.start(PersonaId.COLD_BUYER, PersonaDifficulty.EASY, now);
    const second = SimulationSessionBuilder.start(
      PersonaId.COLD_BUYER,
      PersonaDifficulty.EASY,
      now,
    );
    expect(first.id.equals(second.id)).toBe(false);
  });
});
