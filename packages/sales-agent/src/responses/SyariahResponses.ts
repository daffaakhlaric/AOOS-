/**
 * Syariah-specific response pools (AAOS-W3A-S1 Fix 1). Before this fix, `IntentDetector` correctly
 * detected `DetectedIntent.SYARIAH` (`/syariah/i`, `/halal/i`, `/riba/i`) but `ResponseGenerator`
 * never branched on it, so no reply ever mentioned "syariah"/"halal"/"murabahah" — every syariah
 * inquiry fell through to the generic KREDIT/price flow. Every entry in every pool below mentions
 * at least one of "syariah"/"halal"/"murabahah", and stays ≤ 300 chars (package-wide constraint).
 */

/**
 * General syariah inquiry ("ada syariah gak?", no ASK_PRICE/HESITATION alongside it). Trimmed to
 * ≤ 150 chars each (AAOS-W3D Fix 2 — these were independently found > 150, so shortening them is in
 * scope per that fix's carve-out) while still mentioning syariah/halal/murabahah wording.
 */
export const SYARIAH_RESPONSE_POOL: ReadonlyArray<string> = [
  "Ada kak! Mobix provide pembiayaan syariah — akad murabahah, bukan konvensional 😊 Halal inshaallah 🙏",
  "Tentu kak! Mobix ada pembiayaan syariah kerja sama lembaga terpercaya 😊 Akadnya murabahah, bukan bunga berbunga.",
  "Alhamdulillah ada kak 😊 Pembiayaan syariah tersedia. Gak ada riba — akadnya murabahah. Mau Clara hitung cicilannya?",
];

/** SYARIAH + ASK_PRICE ("ada kredit syariah gak?", "dp syariah berapa?") — DP/price flavored, still syariah-worded so it never regresses to the generic KREDIT price reply. */
export const SYARIAH_DP_RESPONSE_POOL: ReadonlyArray<string> = [
  "DP-nya mulai 15-20% dari harga unit kak, sama seperti konvensional 😊 Bedanya, akad murabahah syariah — gak ada bunga berbunga. Halal inshaallah 🙏",
  "Untuk syariah, DP dan angsurannya kita hitung pakai akad murabahah kak 😊 Harga disepakati di awal, gak ada bunga mengambang. Mau Clara bantu hitung?",
];

/** SYARIAH + HESITATION ("takut riba", "ragu soal syariahnya") — trust/reassurance flavored. */
export const SYARIAH_TRUST_RESPONSE_POOL: ReadonlyArray<string> = [
  "Inshaallah aman kak 🙏 Akad murabahah — harga disepakati di awal, gak ada bunga tersembunyi, gak ada riba.",
  "Wajar kak kalau masih ragu 😊 Pembiayaan syariah Mobix pakai akad murabahah, jelas dan sesuai prinsip syariah — bukan label halal doang.",
];
