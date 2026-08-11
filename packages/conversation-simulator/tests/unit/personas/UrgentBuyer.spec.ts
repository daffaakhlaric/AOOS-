import { LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { PersonaDifficulty } from "../../../src/domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../../../src/domain/value-objects/PersonaId.js";
import { UrgentBuyer } from "../../../src/personas/UrgentBuyer.js";

describe("UrgentBuyer", () => {
  it("has the spec's exact id and EASY difficulty", () => {
    expect(UrgentBuyer.id).toBe(PersonaId.URGENT_BUYER);
    expect(UrgentBuyer.difficulty).toBe(PersonaDifficulty.EASY);
  });

  it("has the spec's exact 6-line script", () => {
    expect(UrgentBuyer.script).toEqual([
      "kak mau beli mobil minggu ini",
      "budget 180 juta",
      "mau Avanza atau Xpander",
      "area Jakarta Selatan",
      "bisa kredit",
      "kapan bisa survei?",
    ]);
  });

  it("expects HOT outcome, maxTurns 7, and an explicit handoff expectation", () => {
    expect(UrgentBuyer.expectedOutcome).toBe(LeadTemperature.HOT);
    expect(UrgentBuyer.maxTurns).toBe(7);
    expect(UrgentBuyer.expectedHandoff).toBe(true);
  });

  it("does not need the follow-up test phase", () => {
    expect(UrgentBuyer.testFollowUp).toBeUndefined();
  });
});
