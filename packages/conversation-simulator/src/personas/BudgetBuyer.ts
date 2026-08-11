import { LeadTemperature } from "@aos/sales-agent";

import type { BuyerPersona } from "../domain/entities/BuyerPersona.js";
import { PersonaDifficulty } from "../domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../domain/value-objects/PersonaId.js";

/** Budget terbatas, price sensitive, takut tidak mampu. */
export const BudgetBuyer: BuyerPersona = {
  id: PersonaId.BUDGET_BUYER,
  name: "Budget Buyer",
  difficulty: PersonaDifficulty.MEDIUM,
  description: "Budget terbatas, price sensitive, takut tidak mampu",
  script: [
    "halo kak ada mobil murah gak?",
    "budget saya cuma 100 juta",
    "yang bagus ada gak di harga segitu?",
    "cicilan berapa kira-kira?",
    "dp nya berapa min?",
    "kayanya masih mahal deh",
  ],
  expectedOutcome: LeadTemperature.WARM,
  maxTurns: 8,
};
