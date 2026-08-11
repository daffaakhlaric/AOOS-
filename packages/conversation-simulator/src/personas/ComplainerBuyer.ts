import { LeadTemperature } from "@aos/sales-agent";

import type { BuyerPersona } from "../domain/entities/BuyerPersona.js";
import { PersonaDifficulty } from "../domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../domain/value-objects/PersonaId.js";

/** Skeptis, banyak keberatan, test objection handling. */
export const ComplainerBuyer: BuyerPersona = {
  id: PersonaId.COMPLAINER_BUYER,
  name: "Complainer Buyer",
  difficulty: PersonaDifficulty.HARD,
  description: "Skeptis, banyak keberatan, test objection handling",
  script: [
    "mobilnya beneran bagus gak sih?",
    "gak takut unit bermasalah?",
    "kemarin temen beli mobil bekas rusak terus",
    "harga segitu mahal banget",
    "leasing bisa kredit gak sih beneran?",
    "oke deh coba lihat dulu",
  ],
  expectedOutcome: LeadTemperature.WARM,
  maxTurns: 10,
};
