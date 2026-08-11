import { LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { PersonaDifficulty } from "../../../src/domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../../../src/domain/value-objects/PersonaId.js";
import { FirstTimeBuyer } from "../../../src/personas/FirstTimeBuyer.js";

describe("FirstTimeBuyer", () => {
  it("has the spec's exact id and difficulty", () => {
    expect(FirstTimeBuyer.id).toBe(PersonaId.FIRST_TIME_BUYER);
    expect(FirstTimeBuyer.difficulty).toBe(PersonaDifficulty.MEDIUM);
  });

  it("has the spec's exact 7-line script", () => {
    expect(FirstTimeBuyer.script).toEqual([
      "halo kak mau tanya soal beli mobil bekas",
      "saya belum pernah beli mobil",
      "bedanya cash sama kredit apa ya?",
      "dp itu apa kak?",
      "kalau kredit nanti unitnya bisa ditarik gak?",
      "ooh gitu, aman ya berarti",
      "budget saya 150 juta kira-kira dapat apa?",
    ]);
  });

  it("expects WARM outcome with maxTurns 10", () => {
    expect(FirstTimeBuyer.expectedOutcome).toBe(LeadTemperature.WARM);
    expect(FirstTimeBuyer.maxTurns).toBe(10);
  });

  it("does not expect a handoff or follow-up test phase", () => {
    expect(FirstTimeBuyer.expectedHandoff).toBeUndefined();
    expect(FirstTimeBuyer.testFollowUp).toBeUndefined();
  });
});
