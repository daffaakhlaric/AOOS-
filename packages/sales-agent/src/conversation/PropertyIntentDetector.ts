/**
 * The PROPERTY-vertical sibling to `DetectedIntent`/`IntentDetector` (spec section 11 point 1):
 * `IntentDetector`'s real `ASK_UNIT`/`ASK_LOCATION` patterns are hard-coded to automotive vocabulary
 * (car model names, Bintaro/Cinere branch names) — this detector swaps those two for real
 * property-buyer wording (`ASK_LISTING` on property-type words, `ASK_AREA` on generic
 * lokasi/kawasan/city words, reusing `PropertyScoreCalculator`'s own `AREA_PATTERN`/
 * `PROPERTY_TYPE_PATTERN` vocabulary so the two stay in lockstep) and keeps every other intent
 * (price/hesitation/complaint/syariah/...) unchanged — none of those are car-specific.
 */
export enum PropertyDetectedIntent {
  ASK_LISTING = "ASK_LISTING",
  ASK_PRICE = "ASK_PRICE",
  ASK_AREA = "ASK_AREA",
  INTEREST = "INTEREST",
  HESITATION = "HESITATION",
  GREETING = "GREETING",
  AFFIRMATIVE = "AFFIRMATIVE",
  BUDGET = "BUDGET",
  CASH = "CASH",
  KPR = "KPR",
  SYARIAH = "SYARIAH",
  COMPLAINT = "COMPLAINT",
}

const ORIGINAL_HESITATION_PATTERNS: ReadonlyArray<RegExp> = [
  /pikir/i,
  /nanti/i,
  /belum/i,
  /cuma tanya/i,
  /lihat-lihat/i,
];

const QUALITY_DOUBT_PATTERNS: ReadonlyArray<RegExp> = [
  /beneran bagus/i,
  /bagus gak/i,
  /beneran aman/i,
  /aman gak/i,
  /bermasalah/i,
  /ada masalah/i,
  /cacat/i,
  /rusak/i,
];

const TRUST_CONCERN_PATTERNS: ReadonlyArray<RegExp> = [
  /takut/i,
  /khawatir/i,
  /ragu/i,
  /gak yakin/i,
  /kurang yakin/i,
];

const PRICE_HESITATION_PATTERNS: ReadonlyArray<RegExp> = [/mahal/i, /kemahalan/i, /terlalu mahal/i];

export const PROPERTY_COMPARISON_PATTERNS: ReadonlyArray<RegExp> = [
  /di tempat lain/i,
  /developer lain/i,
  /lebih murah/i,
];

const CANCEL_PATTERNS: ReadonlyArray<RegExp> = [/gak jadi/i, /cancel/i, /batal/i, /mundur/i];

const INTENT_PATTERNS: Readonly<Record<PropertyDetectedIntent, ReadonlyArray<RegExp>>> = {
  [PropertyDetectedIntent.ASK_LISTING]: [
    /rumah/i,
    /apartemen/i,
    /apart/i,
    /ruko/i,
    /tanah/i,
    /kavling/i,
    /villa/i,
  ],
  [PropertyDetectedIntent.ASK_PRICE]: [/harga/i, /berapa/i, /dp/i, /cicilan/i, /kpr/i, /budget/i],
  [PropertyDetectedIntent.ASK_AREA]: [
    /dimana/i,
    /lokasi/i,
    /area/i,
    /kawasan/i,
    /bintaro/i,
    /cinere/i,
    /jakarta/i,
    /bandung/i,
    /surabaya/i,
  ],
  [PropertyDetectedIntent.INTEREST]: [/mau/i, /minat/i, /pengen/i, /tertarik/i, /bisa/i],
  [PropertyDetectedIntent.HESITATION]: [
    ...ORIGINAL_HESITATION_PATTERNS,
    ...QUALITY_DOUBT_PATTERNS,
    ...TRUST_CONCERN_PATTERNS,
    ...PRICE_HESITATION_PATTERNS,
    ...PROPERTY_COMPARISON_PATTERNS,
    ...CANCEL_PATTERNS,
  ],
  [PropertyDetectedIntent.GREETING]: [/halo/i, /hai/i, /hi/i, /selamat/i, /permisi/i, /min/i],
  [PropertyDetectedIntent.AFFIRMATIVE]: [/iya/i, /ok/i, /oke/i, /bisa/i, /boleh/i, /siap/i],
  [PropertyDetectedIntent.BUDGET]: [/\d+\s*(juta|jt|m|miliar)/i],
  [PropertyDetectedIntent.CASH]: [/cash/i, /tunai/i, /kontan/i],
  [PropertyDetectedIntent.KPR]: [/kpr/i, /kredit/i, /cicil/i, /nyicil/i, /angsuran/i],
  [PropertyDetectedIntent.SYARIAH]: [/syariah/i, /halal/i, /riba/i],
  [PropertyDetectedIntent.COMPLAINT]: [
    /kecewa/i,
    /mengecewakan/i,
    /pengalaman buruk/i,
    /jelek/i,
    /buruk/i,
    /tem(?:a|e)n.*rusak/i,
    /rusak.*tem(?:a|e)n/i,
  ],
};

/** All `PropertyDetectedIntent` members, matching `INTENT_PATTERNS`' declared order. */
export const ALL_PROPERTY_DETECTED_INTENTS: ReadonlyArray<PropertyDetectedIntent> =
  Object.values(PropertyDetectedIntent);

/** Rule-based (no LLM) multi-intent detector over one message's raw text — PROPERTY vertical. A message can match several intents at once. */
export class PropertyIntentDetector {
  static detect(messageText: string): PropertyDetectedIntent[] {
    return ALL_PROPERTY_DETECTED_INTENTS.filter((intent) =>
      INTENT_PATTERNS[intent].some((pattern) => pattern.test(messageText)),
    );
  }

  static has(messageText: string, intent: PropertyDetectedIntent): boolean {
    return INTENT_PATTERNS[intent].some((pattern) => pattern.test(messageText));
  }
}
