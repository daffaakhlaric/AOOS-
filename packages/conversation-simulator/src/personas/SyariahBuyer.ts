import { LeadTemperature } from "@aos/sales-agent";

import type { BuyerPersona } from "../domain/entities/BuyerPersona.js";
import { PersonaDifficulty } from "../domain/value-objects/PersonaDifficulty.js";
import { PersonaId } from "../domain/value-objects/PersonaId.js";

/**
 * Cari kredit syariah, sensitif soal riba.
 *
 * AAOS-W3A-S1 note: the original script only ever supplied one qualifying signal (PAYMENT, from
 * "kredit syariah") — real Jessy's `ScoreCalculator` only awards `PAYMENT`/`UNIT`/`BUDGET`/`AREA`
 * for their own literal keyword patterns, so a script that never mentions a unit model or a budget
 * amount could never cross `hotThreshold` (65), regardless of how syariah-focused it was. This
 * script keeps the same syariah narrative but adds a UNIT signal ("Avanza") and a BUDGET signal
 * ("180 juta"), which combine with the existing PAYMENT signal ("kredit syariah") for
 * 25 + 25 + 25 = 75 ≥ 65 → HOT + handoff (verified against the real, now-fixed engine — see
 * `tests/integration/RunSimulation.syariah.spec.ts`).
 *
 * Deliberately does NOT add an AREA line (e.g. "area Depok bisa?", as the original spec's
 * pseudocode suggested): `ScoreCalculator`'s real `LOCATION_PATTERN` is
 * `/dimana|lokasi|cabang|showroom|bintaro|cinere/i` — it does not match a bare "area X" or "Depok"
 * (that broader match only exists in `QualificationDetector`'s separate `AREA_PATTERN`, a different
 * concern). Extending `LOCATION_PATTERN` was out of scope for this fix and risked unrelated
 * regressions, and it isn't needed anyway: PAYMENT + UNIT + BUDGET alone already reach 75, past
 * `hotThreshold`.
 */
export const SyariahBuyer: BuyerPersona = {
  id: PersonaId.SYARIAH_BUYER,
  name: "Syariah Buyer",
  difficulty: PersonaDifficulty.MEDIUM,
  description: "Cari kredit syariah, sensitif soal riba",
  script: [
    "assalamualaikum kak",
    "ada kredit syariah gak?",
    "saya gak mau yang ada ribanya",
    "mau cari Avanza kak",
    "budget sekitar 180 juta",
    "oke inshaallah mau lanjut survei",
  ],
  expectedOutcome: LeadTemperature.HOT,
  maxTurns: 8,
  expectedHandoff: true,
};
