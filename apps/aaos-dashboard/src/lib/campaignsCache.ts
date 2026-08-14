import type { AdAccountSummaryDto } from "@/types/dashboard.types";

/**
 * `localStorage`-backed cache + last-3-fetches history for `/meta-ads`'s pulled campaign data
 * (MAAO2 redesign). Deliberately `localStorage`, not the in-memory React state the previous
 * iteration used — that lost the pulled data on every page reload/navigation-away-and-back, which
 * meant a routine reload looked identical to "no data yet" and often prompted an unnecessary
 * re-pull. `localStorage` survives reloads; the 30-minute TTL below still caps how long a pull is
 * trusted before a fresh one is needed.
 *
 * Pure, framework-free functions — `MetaAdsClient.tsx` is the only caller, but keeping this
 * `localStorage` access out of the component makes it independently testable and keeps the
 * component from needing to know the storage keys/shape.
 */

export const CAMPAIGNS_CACHE_KEY = "aaos_campaigns_cache";
export const CAMPAIGNS_HISTORY_KEY = "aaos_campaigns_history";
export const CAMPAIGNS_CACHE_TTL_MS = 30 * 60_000; // 30 minutes
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
}
