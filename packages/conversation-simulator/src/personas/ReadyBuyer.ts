import { LeadTemperature } from "@aos/sales-agent";

import type { BuyerPersona } from "../domain/entities/BuyerPersona.js";
import { PersonaDifficulty } from "../domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../domain/value-objects/PersonaId.js";

/** Siap beli, tinggal konfirmasi — harus cepat jadi HOT. */
export const ReadyBuyer: BuyerPersona = {
  id: PersonaId.READY_BUYER,
  name: "Ready Buyer",
  difficulty: PersonaDifficulty.EASY,
  description: "Siap beli, tinggal konfirmasi — harus cepat jadi HOT",
  script: [
    "halo kak mau beli Xpander",
    "budget 200 juta cash",
    "area Cinere bisa?",
    "mau yang AT 2019-2020",
    "bisa survey besok?",
  ],
  expectedOutcome: LeadTemperature.HOT,
  maxTurns: 6,
  expectedHandoff: true,
};
