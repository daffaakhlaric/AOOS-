/**
 * Display-only helper that strips a trailing UUID-looking suffix from an ad's name (spec
 * "=== ID FORMAT ===": "NEVER show UUID... Ad name: strip any UUID suffix from display name.
 * Pattern to strip: ' - Ad [uuid]' or ' · [uuid]'").
 *
 * `Ad.name` (`packages/meta-ads-connector/src/mappers/AdMapper.ts`) is `raw.name` straight from
 * Meta's Graph API — AAOS itself never appends a UUID. This is presumably about a real-world Meta
 * Ads Manager auto-naming quirk (auto-generated ad names sometimes carry a raw id/uuid segment)
 * that cannot be verified against any fixture/sample in this repo — this is BEST-EFFORT pattern
 * matching against the two literal examples the spec gives, not a transformation verified against
 * real Meta data. Applied only at render time; callers MUST NOT persist or otherwise treat the
 * stripped string as the real `ad.name` (e.g. never send it back to `/api/verdicts` as a target
 * identifier — `stableId`/`id` remain the only real identifiers).
 */
const UUID_PATTERN = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const SUFFIX_PATTERN = new RegExp(`(?: - Ad ${UUID_PATTERN}| · ${UUID_PATTERN})$`);

/**
 * Returns `name` with a trailing " - Ad [uuid]" or " · [uuid]" suffix removed, or `name`
 * unchanged if no such suffix is present. Never mutates its input; pure display formatting.
 */
export function stripAdNameSuffix(name: string): string {
  return name.replace(SUFFIX_PATTERN, "");
}
