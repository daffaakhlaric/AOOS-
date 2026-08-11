import { LeadTemperature } from "@aos/sales-agent";

import type { BuyerPersona } from "../domain/entities/BuyerPersona.js";
import { PersonaDifficulty } from "../domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../domain/value-objects/PersonaId.js";

/** Mau beli minggu ini, timeline jelas — cepat HOT. */
export const UrgentBuyer: BuyerPersona = {
  id: PersonaId.URGENT_BUYER,
  name: "Urgent Buyer",
  difficulty: PersonaDifficulty.EASY,
  description: "Mau beli minggu ini, timeline jelas — cepat HOT",
  script: [
    "kak mau beli mobil minggu ini",
    "budget 180 juta",
    "mau Avanza atau Xpander",
    "area Jakarta Selatan",
    "bisa kredit",
    "kapan bisa survei?",
  ],
  expectedOutcome: LeadTemperature.HOT,
  maxTurns: 7,
  expectedHandoff: true,
};
