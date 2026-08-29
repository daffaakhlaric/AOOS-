/**
 * Shared, literal text signals reused across scorers — kept in one place so every scorer's
 * definition of "casual", "formal", "USP mention", etc. stays consistent (spec's "For every other
 * scoring rule, implement it as literally described... using the real fields available on
 * `SimulationResult`").
 */

/** A representative range of emoji Clara's response templates use (spec dimension 1: "😊🙏✅"). */
export const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

/** Casual Indonesian sentence-final particles (spec dimension 1: "kak, nih, deh, dong, sih"). */
export const CASUAL_WORDS_PATTERN = /\b(kak|nih|deh|dong|sih)\b/i;

/** Stiff, overly formal openers (spec dimension 1: "Dengan hormat", "Perkenalkan"). */
export const FORMAL_PHRASE_PATTERN = /Dengan hormat|Perkenalkan/i;

/** The literal robot-greeting opener (spec dimension 1: "starts with 'Halo, saya Clara dari Mobix By DSS Motor'"). */
export const ROBOT_GREETING_PATTERN = /^Halo, saya Clara dari Mobix By DSS Motor/;

/** A bullet point or numbered-list line (spec dimension 1: "contains bullet points or numbered list"). */
export const BULLET_OR_NUMBERED_LIST_PATTERN = /(^|\n)\s*(?:[-•]|\d+[.)])\s+\S/m;

/** Mobix's USP wording (spec dimension 3: "Otospector/150 titik/garansi"). */
export const MOBIX_USP_PATTERN = /Otospector|150 titik|garansi/i;

/** Pushy closing/objection wording (spec dimension 3/4: "harus beli sekarang", "stok terbatas banget"). */
export const PUSHY_PATTERN = /harus beli sekarang|stok terbatas banget/i;

/** Test-drive/survey/schedule wording (spec dimension 4: "test drive / survey / jadwal"). */
export const CLOSING_INTENT_PATTERN = /test\s*drive|survei|survey|jadwal/i;

/** A single, overly formal closing question the spec calls out as an example of "not natural" (spec "Feedback Generation" closing-low example). */
export const ABRUPT_CLOSING_PATTERN = /Apakah Anda tertarik/i;

/** "tim kita" — the sales-team reference the real `handoffPool` template uses (spec dimension 5, verified against `HandoffResponses.ts`). */
export const SALES_TEAM_MENTION_PATTERN = /tim kita/i;
