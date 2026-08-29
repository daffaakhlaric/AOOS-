/**
 * Ground-truth objection/hesitation phrase-matcher (design resolution #1 — see
 * docs/AAOS-AI-JUDGE-REPORT.md). Mirrors `@aos/sales-agent`'s real, current, AAOS-W3A-S1-broadened
 * `HESITATION`/`COMPLAINT` `INTENT_PATTERNS` entries from
 * `packages/sales-agent/src/conversation/IntentDetector.ts` verbatim — copied rather than
 * imported because `IntentDetector`/`DetectedIntent` are internal to `@aos/sales-agent` (not
 * re-exported from its `src/index.ts`, and its `package.json` `exports` map only allows the `"."`
 * subpath, so no deep import is possible). Any future change to Clara's own HESITATION/COMPLAINT
 * vocabulary must be mirrored here too, or the judge's "objection present" ground truth will
 * drift from what Clara itself can detect.
 */
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

const COMPARISON_PATTERNS: ReadonlyArray<RegExp> = [
  /di tempat lain/i,
  /dealer lain/i,
  /lebih murah/i,
];

const CANCEL_PATTERNS: ReadonlyArray<RegExp> = [/gak jadi/i, /cancel/i, /batal/i, /mundur/i];

const HESITATION_PATTERNS: ReadonlyArray<RegExp> = [
  ...ORIGINAL_HESITATION_PATTERNS,
  ...QUALITY_DOUBT_PATTERNS,
  ...TRUST_CONCERN_PATTERNS,
  ...PRICE_HESITATION_PATTERNS,
  ...COMPARISON_PATTERNS,
  ...CANCEL_PATTERNS,
];

const COMPLAINT_PATTERNS: ReadonlyArray<RegExp> = [
  /kecewa/i,
  /mengecewakan/i,
  /pengalaman buruk/i,
  /jelek/i,
  /buruk/i,
  /tem(?:a|e)n.*rusak/i,
  /rusak.*tem(?:a|e)n/i,
];

/** `true` if `text` matches any HESITATION or COMPLAINT ground-truth pattern — Clara's own definition of "an objection signal is present". */
export function hasObjectionSignal(text: string): boolean {
  return (
    HESITATION_PATTERNS.some((p) => p.test(text)) || COMPLAINT_PATTERNS.some((p) => p.test(text))
  );
}
