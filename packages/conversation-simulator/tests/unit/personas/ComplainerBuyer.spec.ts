import { LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { PersonaDifficulty } from "../../../src/domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../../../src/domain/value-objects/PersonaId.js";
import { ComplainerBuyer } from "../../../src/personas/ComplainerBuyer.js";

describe("ComplainerBuyer", () => {
  it("has the spec's exact id and HARD difficulty", () => {
    expect(ComplainerBuyer.id).toBe(PersonaId.COMPLAINER_BUYER);
    expect(ComplainerBuyer.difficulty).toBe(PersonaDifficulty.HARD);
  });

  it("has the spec's exact 6-line objection-heavy script", () => {
    expect(ComplainerBuyer.script).toEqual([
      "mobilnya beneran bagus gak sih?",
      "gak takut unit bermasalah?",
      "kemarin temen beli mobil bekas rusak terus",
      "harga segitu mahal banget",
      "leasing bisa kredit gak sih beneran?",
      "oke deh coba lihat dulu",
    ]);
  });

  it("expects WARM outcome with maxTurns 10", () => {
    expect(ComplainerBuyer.expectedOutcome).toBe(LeadTemperature.WARM);
    expect(ComplainerBuyer.maxTurns).toBe(10);
  });

  it("does not expect a handoff or follow-up test phase", () => {
    expect(ComplainerBuyer.expectedHandoff).toBeUndefined();
    expect(ComplainerBuyer.testFollowUp).toBeUndefined();
  });
});
