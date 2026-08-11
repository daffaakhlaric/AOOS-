import { LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { PersonaDifficulty } from "../../../src/domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../../../src/domain/value-objects/PersonaId.js";
import { SyariahBuyer } from "../../../src/personas/SyariahBuyer.js";

describe("SyariahBuyer", () => {
  it("has the spec's exact id and difficulty", () => {
    expect(SyariahBuyer.id).toBe(PersonaId.SYARIAH_BUYER);
    expect(SyariahBuyer.difficulty).toBe(PersonaDifficulty.MEDIUM);
  });

  it("has the AAOS-W3A-S1 6-line script mentioning riba/syariah plus real qualifying signals (UNIT, BUDGET)", () => {
    expect(SyariahBuyer.script).toEqual([
      "assalamualaikum kak",
      "ada kredit syariah gak?",
      "saya gak mau yang ada ribanya",
      "mau cari Avanza kak",
      "budget sekitar 180 juta",
      "oke inshaallah mau lanjut survei",
    ]);
  });

  it("expects HOT outcome, maxTurns 8, and an explicit handoff expectation", () => {
    expect(SyariahBuyer.expectedOutcome).toBe(LeadTemperature.HOT);
    expect(SyariahBuyer.maxTurns).toBe(8);
    expect(SyariahBuyer.expectedHandoff).toBe(true);
  });

  it("does not need the follow-up test phase", () => {
    expect(SyariahBuyer.testFollowUp).toBeUndefined();
  });
});
