import { LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { PersonaDifficulty } from "../../../src/domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../../../src/domain/value-objects/PersonaId.js";
import { ReadyBuyer } from "../../../src/personas/ReadyBuyer.js";

describe("ReadyBuyer", () => {
  it("has the spec's exact id and difficulty", () => {
    expect(ReadyBuyer.id).toBe(PersonaId.READY_BUYER);
    expect(ReadyBuyer.difficulty).toBe(PersonaDifficulty.EASY);
  });

  it("has the spec's exact 5-line script", () => {
    expect(ReadyBuyer.script).toEqual([
      "halo kak mau beli Xpander",
      "budget 200 juta cash",
      "area Cinere bisa?",
      "mau yang AT 2019-2020",
      "bisa survey besok?",
    ]);
  });

  it("expects HOT outcome, maxTurns 6, and an explicit handoff expectation", () => {
    expect(ReadyBuyer.expectedOutcome).toBe(LeadTemperature.HOT);
    expect(ReadyBuyer.maxTurns).toBe(6);
    expect(ReadyBuyer.expectedHandoff).toBe(true);
  });

  it("does not need the follow-up test phase", () => {
    expect(ReadyBuyer.testFollowUp).toBeUndefined();
  });
});
