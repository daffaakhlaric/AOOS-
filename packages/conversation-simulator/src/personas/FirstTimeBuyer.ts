import { LeadTemperature } from "@aos/sales-agent";

import type { BuyerPersona } from "../domain/entities/BuyerPersona.js";
import { PersonaDifficulty } from "../domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../domain/value-objects/PersonaId.js";

/** Pertama kali beli mobil, bingung, banyak pertanyaan dasar. */
export const FirstTimeBuyer: BuyerPersona = {
  id: PersonaId.FIRST_TIME_BUYER,
  name: "First Time Buyer",
  difficulty: PersonaDifficulty.MEDIUM,
  description: "Pertama kali beli mobil, bingung, banyak pertanyaan dasar",
  script: [
    "halo kak mau tanya soal beli mobil bekas",
    "saya belum pernah beli mobil",
    "bedanya cash sama kredit apa ya?",
    "dp itu apa kak?",
    "kalau kredit nanti unitnya bisa ditarik gak?",
    "ooh gitu, aman ya berarti",
    "budget saya 150 juta kira-kira dapat apa?",
  ],
  expectedOutcome: LeadTemperature.WARM,
  maxTurns: 10,
};
