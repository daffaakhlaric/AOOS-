import { LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { PersonaDifficulty } from "../../../src/domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../../../src/domain/value-objects/PersonaId.js";
import { SpecificUnitBuyer } from "../../../src/personas/SpecificUnitBuyer.js";

describe("SpecificUnitBuyer", () => {
  it("has the spec's exact id and difficulty", () => {
    expect(SpecificUnitBuyer.id).toBe(PersonaId.SPECIFIC_UNIT_BUYER);
    expect(SpecificUnitBuyer.difficulty).toBe(PersonaDifficulty.MEDIUM);
  });

  it("has the spec's exact 6-line script", () => {
    expect(SpecificUnitBuyer.script).toEqual([
      "kak ada Brio RS 2021 gak?",
      "harganya berapa?",
      "bisa kurang gak?",
      "dp nya berapa min?",
      "kredit bisa?",
      "oke deh mau survei",
    ]);
  });

  it("expects HOT outcome with maxTurns 8", () => {
    expect(SpecificUnitBuyer.expectedOutcome).toBe(LeadTemperature.HOT);
    expect(SpecificUnitBuyer.maxTurns).toBe(8);
  });

  it("does not expect a handoff or follow-up test phase", () => {
    expect(SpecificUnitBuyer.expectedHandoff).toBeUndefined();
    expect(SpecificUnitBuyer.testFollowUp).toBeUndefined();
  });
});
