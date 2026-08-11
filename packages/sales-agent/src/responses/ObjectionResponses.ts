import {
  COMPARISON_PATTERNS,
  DetectedIntent,
  QUALITY_DOUBT_PATTERNS,
} from "../conversation/IntentDetector.js";
import { JessyKnowledgeBase } from "../intelligence/JessyKnowledgeBase.js";

import { pickFromPool } from "./PoolSelector.js";

/** Generic "not sure yet" objection pool (spec "Response Templates" — `OBJECTION_NOT_SURE`), used when no specific known objection (mahal, takut bermasalah, ...) matches. */
export const OBJECTION_NOT_SURE: ReadonlyArray<string> = [
  "Gak papa kak, santai aja 😊 Kalau ada yang mau ditanyain lagi, Jessy siap bantu!",
  "No problem kak! Mau lihat-lihat dulu juga boleh. Nanti kalau ada pertanyaan langsung tanya Jessy ya 😊",
];

/**
 * Quality/trust objection pool (AAOS-W3A-S1 Fix 3) — addresses skepticism about the unit's actual
 * condition ("beneran bagus gak?", "takut bermasalah", "temen beli rusak", ...) with Mobix's real
 * inspection/verification story. Every entry mentions "150" and/or "Otospector" so a test asserting
 * either keyword passes regardless of which pool entry `pickFromPool` selects.
 */
export const QUALITY_OBJECTION_POOL: ReadonlyArray<string> = [
  "Wajar kak khawatir soal itu 😊 Semua unit Mobix diinspeksi 150+ titik dan diverifikasi Otospector secara independen. Bukan sekadar klaim — ada laporan inspeksinya yang bisa kak lihat.",
  "Nah itu bedanya Mobix kak 😊 Setiap unit kita verifikasi pakai Otospector — pihak ketiga yang independen, plus inspeksi 150+ titik. Jadi kondisinya bukan tebak-tebakan, ada datanya.",
  "Mobix punya garansi unit kak, jadi kalau ada masalah setelah beli, kita tanggung jawab 😊 Inspeksi 150+ titik dan verifikasi Otospector dulu sebelum dijual — bukan asal jual.",
];

/**
 * Price-comparison objection pool (AAOS-W3A-S1 Fix 3) — for comparison-shopping wording
 * (`COMPARISON_PATTERNS`: "di tempat lain", "dealer lain", "lebih murah") that has no literal key
 * in `JessyKnowledgeBase.objectionHandlers`. Note: plain "mahal"/"kemahalan"/"terlalu mahal"
 * messages are NOT routed here — they already substring-match `objectionHandlers`' pre-existing
 * "mahal" key (checked first, below), which wins by design (no regression to that established
 * response).
 */
export const PRICE_OBJECTION_POOL: ReadonlyArray<string> = [
  "Harga di Mobix sudah transparan kak, gak ada biaya tersembunyi 😊 Kalau mau bandingkan, kita welcome — yang penting kak nyaman dan yakin sama kondisi unitnya.",
  "Mungkin di tempat lain lebih murah kak, tapi Mobix kasih inspeksi 150+ titik + garansi 😊 Beda harga sedikit, tapi ketenangan pikirannya beda.",
];

function isQualityDoubt(messageText: string): boolean {
  return QUALITY_DOUBT_PATTERNS.some((pattern) => pattern.test(messageText));
}

function isPriceComparison(messageText: string): boolean {
  return COMPARISON_PATTERNS.some((pattern) => pattern.test(messageText));
}

/**
 * Resolves an objection response (AAOS-W3A-S1 Fix 3 extends this beyond the original 2-branch
 * shape): a known-objection handler from `JessyKnowledgeBase` wins first (unchanged, highest
 * priority — preserves every pre-existing "mahal"/"takut bermasalah"/... response verbatim); then
 * a `COMPLAINT` intent or a quality-doubt phrase routes to `QUALITY_OBJECTION_POOL`; then a
 * comparison-shopping phrase routes to `PRICE_OBJECTION_POOL`; otherwise a generic
 * `OBJECTION_NOT_SURE` pick — never pushy (spec persona: "Tidak pushy"). `intents` defaults to `[]`
 * so existing 2-arg callers/tests keep working unchanged.
 */
export function getObjectionResponse(
  messageText: string,
  seed: number,
  intents: ReadonlyArray<DetectedIntent> = [],
): string {
  const known = JessyKnowledgeBase.findObjectionHandler(messageText);
  if (known !== undefined) {
    return known;
  }
  if (intents.includes(DetectedIntent.COMPLAINT) || isQualityDoubt(messageText)) {
    return pickFromPool(QUALITY_OBJECTION_POOL, seed);
  }
  if (isPriceComparison(messageText)) {
    return pickFromPool(PRICE_OBJECTION_POOL, seed);
  }
  return pickFromPool(OBJECTION_NOT_SURE, seed);
}
