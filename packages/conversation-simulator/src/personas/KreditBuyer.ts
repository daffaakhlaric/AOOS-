import { LeadTemperature } from "@aos/sales-agent";

import type { BuyerPersona } from "../domain/entities/BuyerPersona.js";
import { PersonaDifficulty } from "../domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../domain/value-objects/PersonaId.js";

/** Mau kredit, takut ditolak leasing karena penghasilan. */
export const KreditBuyer: BuyerPersona = {
  id: PersonaId.KREDIT_BUYER,
  name: "Kredit Buyer",
  difficulty: PersonaDifficulty.MEDIUM,
  description: "Mau kredit, takut ditolak leasing karena penghasilan",
  script: [
    "halo min mau nanya soal kredit",
    "saya karyawan kontrak bisa kredit gak?",
    "penghasilan 5 juta sebulan",
    "dp berapa yang paling ringan?",
    "prosesnya lama gak?",
    "ok mau coba deh",
  ],
  expectedOutcome: LeadTemperature.WARM,
  maxTurns: 8,
};
