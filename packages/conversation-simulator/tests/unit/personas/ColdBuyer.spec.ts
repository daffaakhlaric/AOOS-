import { LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { PersonaDifficulty } from "../../../src/domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../../../src/domain/value-objects/PersonaId.js";
import { ColdBuyer } from "../../../src/personas/ColdBuyer.js";

describe("ColdBuyer", () => {
  it("has the spec's exact id and difficulty", () => {
    expect(ColdBuyer.id).toBe(PersonaId.COLD_BUYER);
    expect(ColdBuyer.difficulty).toBe(PersonaDifficulty.EASY);
  });

  it("has the spec's exact 4-line script", () => {
    expect(ColdBuyer.script).toEqual([
      "halo min",
      "lagi cari mobil",
      "masih lihat-lihat dulu",
      "oke nanti kabarin deh",
    ]);
  });

  it("expects COLD outcome with maxTurns 6", () => {
    expect(ColdBuyer.expectedOutcome).toBe(LeadTemperature.COLD);
    expect(ColdBuyer.maxTurns).toBe(6);
  });

  it("does not expect a handoff or follow-up test phase", () => {
    expect(ColdBuyer.expectedHandoff).toBeUndefined();
    expect(ColdBuyer.testFollowUp).toBeUndefined();
  });

  it("has a non-empty Indonesian description", () => {
    expect(ColdBuyer.description.length).toBeGreaterThan(0);
  });
});
