import type { AdAccountSummaryDto } from "@/types/dashboard.types";

/**
 * `localStorage`-backed cache + last-3-fetches history for `/meta-ads`'s pulled campaign data
 * (MAAO2 redesign). Deliberately `localStorage`, not the in-memory React state the previous
 * iteration used — that lost the pulled data on every page reload/navigation-away-and-back, which
 * meant a routine reload looked identical to "no data yet" and often prompted an unnecessary
 * re-pull. `localStorage` survives reloads; the 60-minute TTL below still caps how long a pull is
 * trusted before a fresh one is needed.
 *
 * Pure, framework-free functions — originally `MetaAdsClient.tsx` was the only caller; the
 * AAOS-TAMARA-PAGES redesign (coordinator note #7) extended this to be the SHARED snapshot cache
 * for all of `/meta-ads`'s pages (`page.tsx`, `audit`, `analisa`, `strategi`, `simulasi`) rather
 * than introducing a second, parallel cache — keeping this `localStorage` access out of any one
 * component makes it independently testable and keeps every caller from needing to know the
 * storage keys/shape.
 */

export const CAMPAIGNS_CACHE_KEY = "aaos_campaigns_cache";
export const CAMPAIGNS_HISTORY_KEY = "aaos_campaigns_history";
/**
 * Bumped from 30 to 60 minutes (AAOS-TAMARA-PAGES redesign, coordinator note #7): the 4 new
 * Tamara pages (`/meta-ads/audit`, `/analisa`, `/strategi`, `/simulasi`) all read this SAME cache
 * — one source of truth for "the current pulled snapshot" across 5 pages now, not just
 * `MetaAdsClient`'s own. A 60-minute window better matches a manager working across several of
 * these pages in one sitting without each page's own staleness check nagging for a re-pull.
 */
export const CAMPAIGNS_CACHE_TTL_MS = 60 * 60_000; // 60 minutes
const MAX_HISTORY_ENTRIES = 3;

export interface CampaignsCacheEntry {
  readonly data: AdAccountSummaryDto;
  readonly fetchedAt: number;
  readonly period: string;
}

function isCacheEntry(value: unknown): value is CampaignsCacheEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<CampaignsCacheEntry>;
  return (
    typeof candidate.fetchedAt === "number" &&
    typeof candidate.period === "string" &&
    typeof candidate.data === "object" &&
    candidate.data !== null
  );
}

function safeParse(raw: string | null): unknown {
  if (raw === null) {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    // Corrupt/foreign localStorage value (e.g. from an older app version) — treat as "no cache",
    // never throw and break the page over it.
    return undefined;
  }
}

/** Reads the current cache entry, or `undefined` if absent/corrupt. Does not check the TTL — see `isCacheFresh`. */
export function readCampaignsCache(): CampaignsCacheEntry | undefined {
  const parsed = safeParse(localStorage.getItem(CAMPAIGNS_CACHE_KEY));
  return isCacheEntry(parsed) ? parsed : undefined;
}

export function isCacheFresh(entry: CampaignsCacheEntry, now: number = Date.now()): boolean {
  return now - entry.fetchedAt < CAMPAIGNS_CACHE_TTL_MS;
}

/** Reads the last-3-fetches history, oldest-dropped-first, or `[]` if absent/corrupt. */
export function readCampaignsHistory(): readonly CampaignsCacheEntry[] {
  const parsed = safeParse(localStorage.getItem(CAMPAIGNS_HISTORY_KEY));
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter(isCacheEntry);
}

/**
 * Fired on `window` right after a successful `writeCampaignsCache()` (real bug fix: embedding
 * `CabangSourceClient` at the top of `MetaAdsClient.tsx`'s own page means two independent readers
 * of this SAME cache now render side by side on one page — without this, clicking "Tarik Data
 * Baru" updated `MetaAdsClient`'s own tree below but left `CabangSourceClient`'s KPI/Per Cabang/
 * Top Campaign numbers at the top stale until its own separate "Perbarui" button was also
 * clicked, which looked broken). Every `useCampaignsSnapshot()` consumer listens for this and
 * re-reads the cache, so any pull from any widget on the page refreshes all of them — same-tab
 * only (a plain DOM event, not `storage`, which never fires in the tab that made the write).
 */
export const CAMPAIGNS_CACHE_UPDATED_EVENT = "aaos-campaigns-cache-updated";

/**
 * Writes `entry` as the new current cache, pushing whatever was current before it onto the front
 * of the history list (capped at 3). A fresh pull that's identical in `period` to the outgoing one
 * still gets recorded — history is "the last 3 times data was pulled", not "the last 3 distinct
 * periods".
 */
export function writeCampaignsCache(entry: CampaignsCacheEntry): void {
  const previous = readCampaignsCache();
  localStorage.setItem(CAMPAIGNS_CACHE_KEY, JSON.stringify(entry));
  if (previous !== undefined) {
    const history = readCampaignsHistory();
    const updated = [previous, ...history].slice(0, MAX_HISTORY_ENTRIES);
    localStorage.setItem(CAMPAIGNS_HISTORY_KEY, JSON.stringify(updated));
  }
  window.dispatchEvent(new Event(CAMPAIGNS_CACHE_UPDATED_EVENT));
}
