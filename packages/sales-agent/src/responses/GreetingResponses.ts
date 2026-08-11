import { pickFromPool } from "./PoolSelector.js";

/** First-message greeting pool (spec "Response Templates (Jessy's voice)" — `GREETING_POOL`). All entries ≤ 300 chars. */
export const GREETING_POOL: ReadonlyArray<string> = [
  "Hai kak! Wah kebetulan banget nih 😊\nLagi cari mobil apa kira-kira?",
  "Halo kak! Ada yang bisa Jessy bantu hari ini? 😊",
  "Hai kak! Makasih udah hubungi Mobix ya 🙌\nMau cari mobil apa nih?",
];

export function getGreeting(seed: number): string {
  return pickFromPool(GREETING_POOL, seed);
}
