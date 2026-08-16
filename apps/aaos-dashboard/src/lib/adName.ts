/**
 * Display-only helper that strips a trailing UUID-looking suffix from an ad's name (spec
 * "=== ID FORMAT ===": "NEVER show UUID... Ad name: strip any UUID suffix from display name.
 * Pattern to strip: ' - Ad [uuid]' or ' · [uuid]'"; extended by the TOTAL UI REBUILD spec's own
 * "=== STRIP UUID FROM NAMES ===" `cleanAdName` example with two more patterns — see below).
 *
 * `Ad.name` (`packages/meta-ads-connector/src/mappers/AdMapper.ts`) is `raw.name` straight from
 * Meta's Graph API — AAOS itself never appends a UUID. This is presumably about a real-world Meta
 * Ads Manager auto-naming quirk (auto-generated ad names sometimes carry a raw id/uuid segment)
 * that cannot be verified against any fixture/sample in this repo — this is BEST-EFFORT pattern
 * matching against the literal examples the spec gives, not a transformation verified against
 * real Meta data. Applied only at render time; callers MUST NOT persist or otherwise treat the
 * stripped string as the real `ad.name` (e.g. never send it back to `/api/verdicts` as a target
 * identifier — `stableId`/`id` remain the only real identifiers).
 *
 * The TOTAL UI REBUILD spec's `cleanAdName` example duplicates this function's purpose almost
 * exactly (built two tasks ago) but adds two patterns this one didn't yet cover — rather than
 * create a second, parallel utility, this function's regex was broadened in place to cover all of:
 *   - " - Ad [uuid]" / " · [uuid]" (original two patterns, unchanged)
 *   - " - Boost/platinum/gold/silver/bronze/diamond [uuid]" (a Meta auto-boost naming variant —
 *     `bronze`/`diamond` added by the TREMOR REBUILD spec's STEP 10, extending the same
 *     keyword-tier alternation the TOTAL UI REBUILD task already built for `platinum/gold/silver`)
 *   - a broader generic " - [8-hex]-[4-hex]-[rest]" UUID-shaped fallback suffix, for names that
 *     don't fit either of the above but still end in a UUID-looking segment
 * All four are anchored to the END of the string only (never strip a UUID-looking segment that
 * happens to appear mid-name) and are checked case-insensitively.
 */
const UUID_PATTERN = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const GENERIC_UUID_SHAPED = "[0-9a-fA-F]{8}-[0-9a-fA-F-]+";
const SUFFIX_PATTERN = new RegExp(
  `(?:\\s*-\\s*(?:Boost|platinum|gold|silver|bronze|diamond)\\s+${UUID_PATTERN}` +
    `|\\s*-\\s*Ad\\s+${UUID_PATTERN}` +
    `|\\s*·\\s*${UUID_PATTERN}` +
    `|\\s*-\\s*${GENERIC_UUID_SHAPED})$`,
  "i",
);

/**
 * Returns `name` with a trailing UUID-looking suffix removed (several known Meta naming variants —
 * see this module's docstring), or `name` unchanged if none match. Never mutates its input; pure
 * display formatting.
 */
export function stripAdNameSuffix(name: string): string {
  return name.replace(SUFFIX_PATTERN, "");
}
