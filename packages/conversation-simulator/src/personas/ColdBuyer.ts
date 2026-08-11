import { LeadTemperature } from "@aos/sales-agent";

import type { BuyerPersona } from "../domain/entities/BuyerPersona.js";
import { PersonaDifficulty } from "../domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../domain/value-objects/PersonaId.js";

/** Hanya sapa, tidak mau share info, perlu dipancing pelan-pelan. */
export const ColdBuyer: BuyerPersona = {
  id: PersonaId.COLD_BUYER,
  name: "Cold Buyer",
  difficulty: PersonaDifficulty.EASY,
  description: "Hanya sapa, tidak mau share info, perlu dipancing pelan-pelan",
  script: ["halo min", "lagi cari mobil", "masih lihat-lihat dulu", "oke nanti kabarin deh"],
  expectedOutcome: LeadTemperature.COLD,
  maxTurns: 6,
};
