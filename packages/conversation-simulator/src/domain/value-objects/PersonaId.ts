/**
 * The 10 fixed DSS Motor buyer personas (spec "10 Buyer Personas"). String values are the exact
 * snake_case ids used by the spec's "Business correctness" section (`ready_buyer`, `urgent_buyer`,
 * `ghost_buyer`, `syariah_buyer`, ...).
 */
export enum PersonaId {
  COLD_BUYER = "cold_buyer",
  BUDGET_BUYER = "budget_buyer",
  READY_BUYER = "ready_buyer",
  SPECIFIC_UNIT_BUYER = "specific_unit_buyer",
  KREDIT_BUYER = "kredit_buyer",
  SYARIAH_BUYER = "syariah_buyer",
  GHOST_BUYER = "ghost_buyer",
  COMPLAINER_BUYER = "complainer_buyer",
  FIRST_TIME_BUYER = "first_time_buyer",
  URGENT_BUYER = "urgent_buyer",
}

/** All 10 persona ids, in the spec's canonical listing order. */
export const ALL_PERSONA_IDS: ReadonlyArray<PersonaId> = [
  PersonaId.COLD_BUYER,
  PersonaId.BUDGET_BUYER,
  PersonaId.READY_BUYER,
  PersonaId.SPECIFIC_UNIT_BUYER,
  PersonaId.KREDIT_BUYER,
  PersonaId.SYARIAH_BUYER,
  PersonaId.GHOST_BUYER,
  PersonaId.COMPLAINER_BUYER,
  PersonaId.FIRST_TIME_BUYER,
  PersonaId.URGENT_BUYER,
];
