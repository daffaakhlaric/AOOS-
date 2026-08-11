import { LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it } from "vitest";

import { PersonaDifficulty } from "../../../src/domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../../../src/domain/value-objects/PersonaId.js";
import { BudgetBuyer } from "../../../src/personas/BudgetBuyer.js";

describe("BudgetBuyer", () => {
  it("has the spec's exact id and difficulty", () => {
    expect(BudgetBuyer.id).toBe(PersonaId.BUDGET_BUYER);
    expect(BudgetBuyer.difficulty).toBe(PersonaDifficulty.MEDIUM);
  });

  it("has the spec's exact 6-line script", () => {
    expect(BudgetBuyer.script).toEqual([
      "halo kak ada mobil murah gak?",
      "budget saya cuma 100 juta",
      "yang bagus ada gak di harga segitu?",
      "cicilan berapa kira-kira?",
      "dp nya berapa min?",
      "kayanya masih mahal deh",
    ]);
  });

  it("expects WARM outcome with maxTurns 8", () => {
    expect(BudgetBuyer.expectedOutcome).toBe(LeadTemperature.WARM);
    expect(BudgetBuyer.maxTurns).toBe(8);
  });

  it("does not expect a handoff or follow-up test phase", () => {
    expect(BudgetBuyer.expectedHandoff).toBeUndefined();
    expect(BudgetBuyer.testFollowUp).toBeUndefined();
  });
});
