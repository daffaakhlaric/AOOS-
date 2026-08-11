import { LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { createBuyerPersona } from "../../../../src/domain/entities/BuyerPersona.js";
import { PersonaDifficulty } from "../../../../src/domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../../../../src/domain/value-objects/PersonaId.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

const VALID = {
  id: PersonaId.COLD_BUYER,
  name: "Cold Buyer",
  difficulty: PersonaDifficulty.EASY,
  description: "test",
  script: ["halo"],
  expectedOutcome: LeadTemperature.COLD,
  maxTurns: 4,
};

describe("createBuyerPersona", () => {
  it("accepts a well-formed persona definition", () => {
    const persona = unwrap(createBuyerPersona(VALID));
    expect(persona).toEqual(VALID);
  });

  it("rejects an empty script", () => {
    const error = unwrapErr(createBuyerPersona({ ...VALID, script: [] }));
    expect(error.message).toContain("non-empty script");
  });

  it("rejects a non-positive maxTurns", () => {
    const error = unwrapErr(createBuyerPersona({ ...VALID, maxTurns: 0 }));
    expect(error.message).toContain("maxTurns");
  });

  it("rejects a non-integer maxTurns", () => {
    const error = unwrapErr(createBuyerPersona({ ...VALID, maxTurns: 2.5 }));
    expect(error.message).toContain("maxTurns");
  });

  it("rejects a blank name", () => {
    const error = unwrapErr(createBuyerPersona({ ...VALID, name: "   " }));
    expect(error.message).toContain("non-empty name");
  });
});
