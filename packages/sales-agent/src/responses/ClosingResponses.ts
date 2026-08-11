import { pickFromPool } from "./PoolSelector.js";

/**
 * Closing-push response pools (AAOS-W3D Fix 1). Every entry mentions "test drive"/"survey"/"jadwal"
 * (`ai-judge`'s `ClosingAttemptScorer` — `CLOSING_INTENT_PATTERN` — checks the very first Jessy
 * message at/after the `CLOSING` transition, so this must hold for every pool member, not just one),
 * stays ≤ 150 chars (AAOS-W3D Fix 2's tightened internal target), and avoids
 * `ABRUPT_CLOSING_PATTERN` ("Apakah Anda tertarik") so `CLOSING_IS_NATURAL` scores too.
 */

/** First closing push for a WARM (not-yet-HOT) lead who's exchanged >= 4 messages (`StageDetector`'s turn-count gate). */
export const CLOSING_WARM_POOL: ReadonlyArray<string> = [
  "Mau Jessy bantu jadwalin test drive kak? Bisa langsung survey unitnya juga 😊",
  "Kapan kira-kira kak mau survey unitnya? Bisa kita atur jadwalnya 😊",
  "Kalau mau lihat langsung unitnya, bisa jadwalin test drive kak 😊",
];

/** Closing push for a HOT lead (score >= hotThreshold) — same turn `StageDetector` returns CLOSING with top priority. */
export const CLOSING_HOT_POOL: ReadonlyArray<string> = [
  "Kak mau jadwalin test drive kapan? Stok masih ada nih 😊",
  "Mau survey unitnya langsung kak? Jessy bantu atur jadwalnya 🙏",
  "Bisa survey hari ini atau besok kak? Tim kita siap bantu 😊",
];

/** Follow-up closing push — used once `closingAttemptCount >= 1` for a still-WARM lead who hasn't gone HOT or replied to the first push. */
export const CLOSING_FOLLOW_POOL: ReadonlyArray<string> = [
  "Gimana kak, mau Jessy bantu jadwalin surveynya? 😊",
  "Kalau udah yakin, tinggal tentuin jadwal test drive aja kak 🙏",
];

/**
 * Picks the right closing pool given the lead's current score/attempt count (spec's Fix 1
 * dispatcher, adapted to real `LeadConversation` accessors): HOT score wins outright (regardless of
 * attempt count — a HOT lead should always get the punchiest push, right before `HANDOFF` takes
 * over); otherwise the first attempt uses the WARM pool and every attempt after that uses the FOLLOW
 * pool.
 */
export function getClosingResponse(
  scoreNumber: number,
  closingAttemptCount: number,
  hotThreshold: number,
  seed: number,
): string {
  if (scoreNumber >= hotThreshold) {
    return pickFromPool(CLOSING_HOT_POOL, seed);
  }
  if (closingAttemptCount === 0) {
    return pickFromPool(CLOSING_WARM_POOL, seed);
  }
  return pickFromPool(CLOSING_FOLLOW_POOL, seed);
}
