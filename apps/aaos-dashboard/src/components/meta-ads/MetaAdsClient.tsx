"use client";

import { useEffect, useRef, useState } from "react";

import { CampaignTree } from "@/components/meta-ads/CampaignTree";
import { DateRangeSelector } from "@/components/meta-ads/DateRangeSelector";
import { MetricsSummaryBar } from "@/components/meta-ads/MetricsSummaryBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  CAMPAIGNS_CACHE_TTL_MS,
  readCampaignsCache,
  readCampaignsHistory,
  writeCampaignsCache,
  type CampaignsCacheEntry,
} from "@/lib/campaignsCache";
import { formatDateTimeIdWib } from "@/lib/formatters";
import type { AdAccountSummaryDto } from "@/types/dashboard.types";

import styles from "./MetaAdsClient.module.css";

const RATE_LIMIT_MESSAGE_NO_CACHE = "Meta API sedang sibuk. Tunggu beberapa menit lalu coba lagi.";
const RATE_LIMIT_MESSAGE_WITH_CACHE =
  "⚠️ Meta API sedang sibuk. Data terakhir ditampilkan dari cache. Tarik data baru dalam beberapa menit.";
const GENERIC_REFRESH_FAILURE =
  "Gagal menarik data terbaru. Data di bawah masih dari tarikan sebelumnya.";

/**
 * Preset labels shown in "Data diambil: ... · periode ...". Real bug fix / spec deviation: the
 * MAAO2 mockup shows an explicit "periode 2026-08-01 → 2026-08-13" date range, but `aaos-api`'s
 * real `GET /api/v1/campaigns` only accepts `datePreset: "last_7d" | "last_14d" | "last_30d"` —
 * there is no `dateFrom`/`dateTo` param, and the response carries no computed date boundaries
 * either (see `PullCampaignsQuerySchema`/`AdAccountResponseDto` in `apps/aaos-api`). Fabricating
 * "→" boundaries client-side from the preset name would show dates that might not exactly match
 * what Meta actually used (calendar-day/timezone edge cases in Meta's own preset semantics), so
 * this shows the preset's own label instead of invented start/end dates — the same judgment call
 * `DateRangeSelector.tsx` already documents for the "[Dari: ...] [Sampai: ...]" mockup control.
 */
const DATE_PRESET_LABELS: Readonly<Record<string, string>> = {
  last_7d: "7 hari terakhir",
  last_14d: "14 hari terakhir",
  last_30d: "30 hari terakhir",
};

interface RefreshBanner {
  readonly message: string;
  readonly tone: "warning" | "danger";
}

/**
 * Renders the MAAO2-style campaign→ad-set→ad tree (spec "meta-ads/page.tsx" redesign).
 *
 * Caching model (real bug fix, 3rd pass): earlier versions of this component either auto-fetched
 * on mount (tripping Meta's rate limit) or cached only in React state / a short in-memory server
 * cache (both lost on every page reload). This version persists the last pull to `localStorage`
 * (60-minute TTL, `src/lib/campaignsCache.ts`) so a reload/reopen shows the last real data
 * immediately with NO network call — only an explicit "Tarik Data Baru" click ever hits
 * `/api/campaigns`. That click always forces a genuinely fresh pull (bypassing both this
 * `localStorage` cache and `/api/campaigns`'s own 5-minute server-side cache via `refresh=1`) —
 * unlike earlier versions, a click here is never a silent no-op, since the whole point of the
 * button is "give me current numbers now."
 *
 * Rate-limit handling: if a pull returns 429/503 (Meta actually rate-limiting, or Meta's API being
 * down — `ErrorCode.RATE_LIMITED`/`ErrorCode.UNAVAILABLE` in `aaos-exception.filter.ts`) while
 * there is already data on screen (fresh or stale, from cache or a previous pull), that data stays
 * up and an orange banner explains the failed refresh — never replaced by a blank/error state. Only
 * when there is truly nothing to show yet does a 429/503 render as a blocking message.
 */
export function MetaAdsClient(): React.ReactElement {
  const [datePreset, setDatePreset] = useState("last_30d");
  const [data, setData] = useState<AdAccountSummaryDto | undefined>(undefined);
  const [fetchedAt, setFetchedAt] = useState<number | undefined>(undefined);
  const [history, setHistory] = useState<readonly CampaignsCacheEntry[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [refreshBanner, setRefreshBanner] = useState<RefreshBanner | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  /** See the `mountedRef`/React Strict Mode docstring in this file's git history — the setup phase MUST reset this to `true`, not only the cleanup set it `false`, or Strict Mode's dev-only mount→cleanup→remount cycle leaves every subsequent `setState` here permanently no-opped. */
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Initial load: read localStorage only — never a network call. An effect (not a useState lazy
  // initializer) because `localStorage` doesn't exist during this "use client" component's SSR
  // pass; touching it outside an effect would throw / cause a hydration mismatch.
  useEffect(() => {
    const cached = readCampaignsCache();
    if (cached !== undefined) {
      setData(cached.data);
      setFetchedAt(cached.fetchedAt);
      setDatePreset(cached.period);
    }
    setHistory(readCampaignsHistory());
  }, []);

  async function pullData(): Promise<void> {
    setLoading(true);
    setRefreshBanner(undefined);
    const params = new URLSearchParams({ datePreset, refresh: "1" });
    try {
      const res = await fetch(`/api/campaigns?${params.toString()}`);
      if (res.status === 429 || res.status === 503) {
        if (mountedRef.current) {
          if (data !== undefined) {
            setRefreshBanner({ message: RATE_LIMIT_MESSAGE_WITH_CACHE, tone: "warning" });
          } else {
            setError(RATE_LIMIT_MESSAGE_NO_CACHE);
          }
        }
        return;
      }
      if (!res.ok) {
        throw new Error("Gagal memuat data iklan.");
      }
      const body = (await res.json()) as AdAccountSummaryDto;
      if (mountedRef.current) {
        const entry: CampaignsCacheEntry = {
          data: body,
          fetchedAt: Date.now(),
          period: datePreset,
        };
        writeCampaignsCache(entry);
        setData(body);
        setFetchedAt(entry.fetchedAt);
        setError(undefined);
        setHistory(readCampaignsHistory());
      }
    } catch (caught) {
      if (mountedRef.current) {
        const message = caught instanceof Error ? caught.message : "Gagal memuat data iklan.";
        if (data !== undefined) {
          setRefreshBanner({ message: GENERIC_REFRESH_FAILURE, tone: "danger" });
        } else {
          setError(message);
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  /** Executes a verdict via `/api/verdicts` (proxying `aaos-api`'s real `POST /api/v1/verdicts`), then force-pulls fresh data so the tree reflects the target's new (paused/scaled/...) status immediately. */
  function handleExecute(
    targetId: string,
    targetType: "ad" | "adset" | "campaign",
    verdict: string,
  ): void {
    void fetch("/api/verdicts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ verdict, targetId, targetType }),
    })
      .then(() => pullData())
      .catch(() => undefined);
  }

  /** Switches the displayed snapshot to a past pull from the "Riwayat tarikan" dropdown — a read-only view, does not overwrite the current `localStorage` cache. */
  function handleViewHistory(entry: CampaignsCacheEntry): void {
    setData(entry.data);
    setFetchedAt(entry.fetchedAt);
    setDatePreset(entry.period);
    setError(undefined);
    setRefreshBanner(undefined);
  }

  const cacheStale = fetchedAt !== undefined && Date.now() - fetchedAt >= CAMPAIGNS_CACHE_TTL_MS;
  const currentSnapshotLabel =
    fetchedAt !== undefined ? formatDateTimeIdWib(new Date(fetchedAt).toISOString()) : undefined;

  return (
    <div className={styles.page}>
      <div>
        <h2 className={styles.pageTitle}>Data Iklan</h2>
        <p className={styles.pageSubtitle}>
          Hierarki: Kampanye → Ad Set → Ad (#A #B #C). Setiap iklan menampilkan mini funnel: Klik ·
          Chat · D2 · D3 · Form.
        </p>
      </div>

      {/* Toolbar: snapshot selector · period preset · pull-fresh action (spec "=== TOOLBAR ==="). */}
      <div className={styles.toolbar}>
        {history.length > 0 || currentSnapshotLabel !== undefined ? (
          <details className={styles.snapshotSelector}>
            <summary data-testid="snapshot-selector" className={styles.snapshotSummary}>
              🗂 {currentSnapshotLabel ?? "Riwayat tarikan"} ▾
            </summary>
            <ul className={styles.snapshotMenu}>
              {history.length > 0 ? (
                history.map((entry) => (
                  <li key={entry.fetchedAt}>
                    <button
                      type="button"
                      onClick={() => handleViewHistory(entry)}
                      className={styles.snapshotMenuItem}
                    >
                      {formatDateTimeIdWib(new Date(entry.fetchedAt).toISOString())} ·{" "}
                      {DATE_PRESET_LABELS[entry.period] ?? entry.period}
                    </button>
                  </li>
                ))
              ) : (
                <li className={styles.snapshotMenuEmpty}>Riwayat tarikan</li>
              )}
            </ul>
          </details>
        ) : null}
        <DateRangeSelector value={datePreset} onChange={setDatePreset} />
        <span className={styles.spacer} />
        <button
          type="button"
          onClick={() => void pullData()}
          disabled={loading}
          className={styles.pullButton}
        >
          ↻ Tarik Data Baru
        </button>
      </div>
      {fetchedAt !== undefined ? (
        <p data-testid="last-updated" className={styles.lastUpdated}>
          🕒 Diambil {formatDateTimeIdWib(new Date(fetchedAt).toISOString())} · periode{" "}
          {DATE_PRESET_LABELS[datePreset] ?? datePreset}
          {cacheStale ? " (lebih dari 60 menit lalu)" : ""}
        </p>
      ) : null}
      {refreshBanner !== undefined ? (
        <div
          data-testid="rate-limit-banner"
          data-tone={refreshBanner.tone}
          className={`${styles.banner} ${refreshBanner.tone === "warning" ? styles.bannerWarning : styles.bannerDanger}`}
        >
          {refreshBanner.message}
        </div>
      ) : null}
      {data === undefined && loading ? <LoadingSpinner /> : null}
      {data === undefined && !loading && error !== undefined ? <ErrorCard message={error} /> : null}
      {data === undefined && !loading && error === undefined ? (
        <EmptyState
          title="Belum ada data"
          description='Klik "Tarik Data Baru" untuk memuat data iklan dari Meta.'
        />
      ) : null}
      {data !== undefined ? (
        <>
          {loading ? <p className={styles.updating}>Memperbarui data…</p> : null}
          <div className={styles.searchWrap}>
            <span aria-hidden="true" className={styles.searchIcon}>
              🔍
            </span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama/ID campaign, Xpander, Bintaro..."
              aria-label="Cari campaign"
              className={styles.searchInput}
            />
          </div>
          <MetricsSummaryBar
            totals={data.totals}
            campaignCount={data.campaignCount}
            adCount={data.adCount}
          />
          {/* "Kampanye (N)" section header + verdict color legend (reference screenshot's "Kampanye
              (3)" row). FIX/PAUSE share the accent color (`accentPause` in CampaignTree.module.css,
              same real-verdict-precedence judgment call as `aggregateVerdict`), so the legend shows
              one dot per distinct color rather than one per verdict name. */}
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Kampanye ({data.campaigns.length})</h3>
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span aria-hidden="true" className={`${styles.legendDot} ${styles.legendPause}`} />
                FIX / PAUSE
              </span>
              <span className={styles.legendItem}>
                <span aria-hidden="true" className={`${styles.legendDot} ${styles.legendKeep}`} />
                KEEP
              </span>
              <span className={styles.legendItem}>
                <span aria-hidden="true" className={`${styles.legendDot} ${styles.legendScale}`} />
                SCALE
              </span>
              <span className={styles.legendItem}>
                <span aria-hidden="true" className={`${styles.legendDot} ${styles.legendReview}`} />
                REVIEW
              </span>
              <span className={styles.legendItem}>
                <span
                  aria-hidden="true"
                  className={`${styles.legendDot} ${styles.legendRefresh}`}
                />
                REFRESH
              </span>
            </div>
          </div>
          <CampaignTree campaigns={data.campaigns} search={search} onExecute={handleExecute} />
        </>
      ) : null}
    </div>
  );
}
