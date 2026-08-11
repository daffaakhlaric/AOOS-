/** The 13 rule-based intents Jessy detects from an inbound message's raw text (spec "Intent Detection (Rule-based)"), extended by AAOS-W3A-S1 with `COMPLAINT` (a stronger, distinct negative signal from a HESITATION quality doubt — e.g. a friend's bad experience, not just "is this any good?"). */
export enum DetectedIntent {
  ASK_UNIT = "ASK_UNIT",
  ASK_PRICE = "ASK_PRICE",
  ASK_STOCK = "ASK_STOCK",
  ASK_LOCATION = "ASK_LOCATION",
  INTEREST = "INTEREST",
  HESITATION = "HESITATION",
  GREETING = "GREETING",
  AFFIRMATIVE = "AFFIRMATIVE",
  BUDGET = "BUDGET",
  CASH = "CASH",
  KREDIT = "KREDIT",
  SYARIAH = "SYARIAH",
  COMPLAINT = "COMPLAINT",
}

/** The original 5 literal HESITATION phrases (pre-AAOS-W3A-S1) — kept as their own group so the regression tests can assert them independently of the broadened set below. */
const ORIGINAL_HESITATION_PATTERNS: ReadonlyArray<RegExp> = [
  /pikir/i,
  /nanti/i,
  /belum/i,
  /cuma tanya/i,
  /lihat-lihat/i,
];

/** Skeptical doubt about the unit's actual condition/quality (AAOS-W3A-S1 Fix 2). Exported so `ObjectionResponses` can route these to `QUALITY_OBJECTION_POOL` without duplicating the regex literals. */
export const QUALITY_DOUBT_PATTERNS: ReadonlyArray<RegExp> = [
  /beneran bagus/i,
  /bagus gak/i,
  /beneran aman/i,
  /aman gak/i,
  /bermasalah/i,
  /ada masalah/i,
  /cacat/i,
  /rusak/i,
];

/** General trust/anxiety wording (AAOS-W3A-S1 Fix 2) — distinct from a concrete quality doubt above, but still routed to OBJECTION stage. */
const TRUST_CONCERN_PATTERNS: ReadonlyArray<RegExp> = [
  /takut/i,
  /khawatir/i,
  /ragu/i,
  /gak yakin/i,
  /kurang yakin/i,
];

/** Price-is-too-high wording (AAOS-W3A-S1 Fix 2). Note: `JessyKnowledgeBase.objectionHandlers`'s pre-existing "mahal" key already substring-matches every entry here, so in practice these route through the existing transparent-pricing handler, not `PRICE_OBJECTION_POOL` — see `ObjectionResponses.ts`'s doc comment. */
const PRICE_HESITATION_PATTERNS: ReadonlyArray<RegExp> = [/mahal/i, /kemahalan/i, /terlalu mahal/i];

/** Comparison-shopping wording (AAOS-W3A-S1 Fix 2) — the one HESITATION sub-group `JessyKnowledgeBase.objectionHandlers` has no literal key for, so it's the one that actually reaches `PRICE_OBJECTION_POOL`. Exported for reuse by `ObjectionResponses`. */
export const COMPARISON_PATTERNS: ReadonlyArray<RegExp> = [
  /di tempat lain/i,
  /dealer lain/i,
  /lebih murah/i,
];

/** "Never mind, I'm backing out" wording (AAOS-W3A-S1 Fix 2). */
const CANCEL_PATTERNS: ReadonlyArray<RegExp> = [/gak jadi/i, /cancel/i, /batal/i, /mundur/i];

const INTENT_PATTERNS: Readonly<Record<DetectedIntent, ReadonlyArray<RegExp>>> = {
  [DetectedIntent.ASK_UNIT]: [/xpander/i, /brio/i, /avanza/i, /raize/i, /rush/i, /stargazer/i],
  [DetectedIntent.ASK_PRICE]: [/harga/i, /berapa/i, /dp/i, /cicilan/i, /kredit/i, /budget/i],
  [DetectedIntent.ASK_STOCK]: [/ada/i, /stok/i, /ready/i, /tersedia/i],
  [DetectedIntent.ASK_LOCATION]: [
    /dimana/i,
    /lokasi/i,
    /cabang/i,
    /showroom/i,
    /bintaro/i,
    /cinere/i,
  ],
  [DetectedIntent.INTEREST]: [/mau/i, /minat/i, /pengen/i, /tertarik/i, /bisa/i],
  [DetectedIntent.HESITATION]: [
    ...ORIGINAL_HESITATION_PATTERNS,
    ...QUALITY_DOUBT_PATTERNS,
    ...TRUST_CONCERN_PATTERNS,
    ...PRICE_HESITATION_PATTERNS,
    ...COMPARISON_PATTERNS,
    ...CANCEL_PATTERNS,
  ],
  [DetectedIntent.GREETING]: [/halo/i, /hai/i, /hi/i, /selamat/i, /permisi/i, /min/i],
  [DetectedIntent.AFFIRMATIVE]: [/iya/i, /ok/i, /oke/i, /bisa/i, /boleh/i, /siap/i],
  [DetectedIntent.BUDGET]: [/\d+\s*(juta|jt|rb|ribu)/i],
  [DetectedIntent.CASH]: [/cash/i, /tunai/i, /kontan/i],
  [DetectedIntent.KREDIT]: [/kredit/i, /cicil/i, /nyicil/i, /angsuran/i],
  [DetectedIntent.SYARIAH]: [/syariah/i, /halal/i, /riba/i],
  [DetectedIntent.COMPLAINT]: [
    /kecewa/i,
    /mengecewakan/i,
    /pengalaman buruk/i,
    /jelek/i,
    /buruk/i,
    /tem(?:a|e)n.*rusak/i,
    /rusak.*tem(?:a|e)n/i,
  ],
};

/** All 12 `DetectedIntent` members, matching `INTENT_PATTERNS`' declared order. */
export const ALL_DETECTED_INTENTS: ReadonlyArray<DetectedIntent> = Object.values(DetectedIntent);

/** Rule-based (no LLM) multi-intent detector over one message's raw text (spec "Intent Detection (Rule-based)"). A message can match several intents at once. */
export class IntentDetector {
  static detect(messageText: string): DetectedIntent[] {
    return ALL_DETECTED_INTENTS.filter((intent) =>
      INTENT_PATTERNS[intent].some((pattern) => pattern.test(messageText)),
    );
  }

  static has(messageText: string, intent: DetectedIntent): boolean {
    return INTENT_PATTERNS[intent].some((pattern) => pattern.test(messageText));
  }
}
