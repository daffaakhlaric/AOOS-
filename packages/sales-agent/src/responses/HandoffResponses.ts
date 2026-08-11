import { pickFromPool } from "./PoolSelector.js";

/** Handoff-transition response pool (spec "Response Templates" — `HANDOFF(salesName)`). */
export function handoffPool(salesName: string): ReadonlyArray<string> {
  return [
    `Oke kak! Jessy sambungin ke ${salesName} dari tim kita ya, dia yang bisa bantu lebih detail dan atur jadwal test drive 🙏\nSebentar ya kak!`,
  ];
}

export function getHandoffResponse(salesName: string, seed: number): string {
  return pickFromPool(handoffPool(salesName), seed);
}
