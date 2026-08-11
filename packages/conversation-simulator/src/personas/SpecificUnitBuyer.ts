import { LeadTemperature } from "@aos/sales-agent";

import type { BuyerPersona } from "../domain/entities/BuyerPersona.js";
import { PersonaDifficulty } from "../domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../domain/value-objects/PersonaId.js";

/** Sudah tau mau unit apa tapi mau negosiasi harga. */
export const SpecificUnitBuyer: BuyerPersona = {
  id: PersonaId.SPECIFIC_UNIT_BUYER,
  name: "Specific Unit Buyer",
  difficulty: PersonaDifficulty.MEDIUM,
  description: "Sudah tau mau unit apa tapi mau negosiasi harga",
  script: [
    "kak ada Brio RS 2021 gak?",
    "harganya berapa?",
    "bisa kurang gak?",
    "dp nya berapa min?",
    "kredit bisa?",
    "oke deh mau survei",
  ],
  expectedOutcome: LeadTemperature.HOT,
  maxTurns: 8,
};
