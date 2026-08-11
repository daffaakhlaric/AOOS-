import { LeadTemperature } from "@aos/sales-agent";

import type { BuyerPersona } from "../domain/entities/BuyerPersona.js";
import { PersonaDifficulty } from "../domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../domain/value-objects/PersonaId.js";

/** Jawab 2-3 pesan lalu diam — test follow up Jessy. */
export const GhostBuyer: BuyerPersona = {
  id: PersonaId.GHOST_BUYER,
  name: "Ghost Buyer",
  difficulty: PersonaDifficulty.HARD,
  description: "Jawab 2-3 pesan lalu diam — test follow up Jessy",
  script: ["halo min", "mau tanya Xpander", "oh oke"],
  expectedOutcome: LeadTemperature.COLD,
  maxTurns: 4,
  testFollowUp: true,
};
