import { pickFromPool } from "./PoolSelector.js";

/** Open-ended discovery questions — Clara finding out what the lead wants, before qualification (spec "DiscoveryResponses.ts"). */
export const DISCOVERY_POOL: ReadonlyArray<string> = [
  "Rencananya buat dipakai harian, keluarga, atau usaha nih kak? 😊",
  "Ada tipe mobil yang lagi kak incar? MPV, city car, atau SUV? 😊",
  "Kira-kira budget dan tipe mobilnya udah kebayang belum kak? 😊",
];

/** Budget follow-up pool (spec "Response Templates" — `BUDGET_FOLLOW_UP`). */
export const BUDGET_FOLLOW_UP: ReadonlyArray<string> = [
  "Budget-nya kira-kira berapa kak? Biar Clara cariin yang paling cucok 😊",
  "Range budget-nya sekitar berapa ya kak?",
];

export function getDiscoveryQuestion(seed: number): string {
  return pickFromPool(DISCOVERY_POOL, seed);
}

export function getBudgetFollowUp(seed: number): string {
  return pickFromPool(BUDGET_FOLLOW_UP, seed);
}
