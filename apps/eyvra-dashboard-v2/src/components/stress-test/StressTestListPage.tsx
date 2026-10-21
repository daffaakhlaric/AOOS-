"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import type { StressTestRunDto } from "@/lib/stress-test";
import {
  DEFAULT_HISTORY_FILTERS,
  PAGE_SIZES,
  mapSimulationHistory,
  mapSimulationRunListItem,
  type PageSize,
  type SimulationHistoryFilters,
} from "@/lib/stress-test-history";
import { POLL_INTERVAL_MS } from "@/lib/stress-test-progress";
import { parseListingContext, type ListingContext } from "@/lib/stress-test-result";
import { SimulationRunFilters } from "./history/SimulationRunFilters";
import { SimulationRunsTable } from "./history/SimulationRunsTable";
import historyStyles from "./history/history.module.css";
import { CompareRunsDrawer } from "./result/CompareRunsDrawer";
import styles from "./StressTestListPage.module.css";

/** Real persona preset labels (static config endpoint); failure just falls back to result labels / ids. */
function usePersonaLabels(): ReadonlyMap<string, string> {
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(new Map());
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/creative-stress-test/persona-presets", { signal: controller.signal })
      .then(async (r) => (r.ok ? ((await r.json()) as { presets?: unknown }) : undefined))
      .then((body) => {
        if (controller.signal.aborted || body === undefined || !Array.isArray(body.presets)) return;
        const map = new Map<string, string>();
        for (const p of body.presets as unknown[]) {
          if (p !== null && typeof p === "object") {
            const { id, label } = p as { id?: unknown; label?: unknown };
            if (typeof id === "string" && typeof label === "string") map.set(id, label);
          }
        }
        setLabels(map);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  return labels;
}

/**
 * Real listing context for every distinct `listingId` in the history (deduped, fetched once each).
 * Campaign runs are NOT resolved here (no per-row workspace load) — their title comes from the one
 * lightweight `/api/campaigns` list (`useCampaignNames`), else "—".
 */
function useListingContexts(
  runs: readonly StressTestRunDto[] | undefined,
): ReadonlyMap<string, ListingContext | null> {
  const [listings, setListings] = useState<ReadonlyMap<string, ListingContext | null>>(new Map());
  const ids = useMemo(
    () =>
      [
        ...new Set((runs ?? []).flatMap((r) => (r.listingId !== undefined ? [r.listingId] : []))),
      ].sort(),
    [runs],
  );
  const idsKey = ids.join("|");
  useEffect(() => {
    if (ids.length === 0) return;
    const controller = new AbortController();
    for (const id of ids) {
      fetch(`/api/listings/${encodeURIComponent(id)}`, { signal: controller.signal })
        .then(async (r) => (r.ok ? ((await r.json()) as unknown) : undefined))
        .then((body) => {
          if (controller.signal.aborted) return;
          setListings((prev) => new Map(prev).set(id, parseListingContext(body) ?? null));
        })
        .catch(() => {
          if (!controller.signal.aborted) setListings((prev) => new Map(prev).set(id, null));
        });
    }
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the stable id list
  }, [idsKey]);
  return listings;
}

/**
 * Real campaign names for the Context column — the SAME lightweight `/api/campaigns` list the
 * builder already uses (`{ campaigns: { id, name }[] }`), fetched at most ONCE and only when the
 * history actually contains a campaign-context run without a listing. Never a per-row workspace
 * load. A failed fetch leaves the map empty (titles stay "—").
 */
export function useCampaignNames(runs: readonly StressTestRunDto[] | undefined): {
  readonly names: ReadonlyMap<string, string>;
  readonly loading: boolean;
} {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const started = useRef(false);
  const needed = (runs ?? []).some((r) => r.campaignId !== undefined && r.listingId === undefined);
  useEffect(() => {
    if (!needed || started.current) return;
    started.current = true;
    let cancelled = false;
    setLoading(true);
    fetch("/api/campaigns")
      .then(async (r) => (r.ok ? ((await r.json()) as { campaigns?: unknown }) : undefined))
      .then((body) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        if (body !== undefined && Array.isArray(body.campaigns)) {
          for (const c of body.campaigns as unknown[]) {
            if (c !== null && typeof c === "object") {
              const { id, name } = c as { id?: unknown; name?: unknown };
              if (typeof id === "string" && typeof name === "string" && name.trim().length > 0)
                map.set(id, name);
            }
          }
        }
        setNames(map);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needed]);
  return { names, loading };
}

async function fetchRuns(signal: AbortSignal): Promise<StressTestRunDto[]> {
  const r = await fetch("/api/creative-stress-test", { signal, cache: "no-store" });
  if (!r.ok) throw new Error();
  const body = (await r.json()) as { runs?: unknown };
  return Array.isArray(body.runs) ? (body.runs as StressTestRunDto[]) : [];
}

export function StressTestListPage(): React.ReactElement {
  const [runs, setRuns] = useState<readonly StressTestRunDto[] | undefined>();
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState<SimulationHistoryFilters>(DEFAULT_HISTORY_FILTERS);
  const [compareRunId, setCompareRunId] = useState<string | undefined>();
  const [nowMs] = useState(() => Date.now());
  const personaLabels = usePersonaLabels();
  const listings = useListingContexts(runs);
  const campaigns = useCampaignNames(runs);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetchRuns(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setRuns(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);

  const items = useMemo(
    () =>
      (runs ?? []).map((run) =>
        mapSimulationRunListItem(run, {
          listings,
          personaLabels,
          nowMs,
          campaignNames: campaigns.names,
          campaignsLoading: campaigns.loading,
        }),
      ),
    [runs, listings, personaLabels, nowMs, campaigns.names, campaigns.loading],
  );
  const page = useMemo(() => mapSimulationHistory(items, filters), [items, filters]);

  // Poll every POLL_INTERVAL_MS ONLY while a visible row is QUEUED/RUNNING; stops as soon as none
  // is (effect cleanup clears the timer and aborts any in-flight request, also on unmount).
  const pollVisible = page.rows.some((row) => row.inProgress);
  useEffect(() => {
    if (!pollVisible) return;
    const controller = new AbortController();
    let inFlight = false;
    const timer = setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      fetchRuns(controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) setRuns(next);
        })
        .catch(() => undefined)
        .finally(() => {
          inFlight = false;
        });
    }, POLL_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [pollVisible]);
  const compareRun = runs?.find((r) => r.id === compareRunId);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Creative Stress Test</h1>
          <p>Riwayat run uji ketahanan creative — persona pembeli dan sumber objection.</p>
        </div>
        <Link href="/samantha/stress-test/run" className={styles.primary}>
          + Uji Ketahanan Creative Baru
        </Link>
      </header>
      <Link href="/samantha/simulation/compare" className={styles.primary}>
        Compare Runs →
      </Link>
      <Card
        title="Simulation Runs"
        subtitle="Hasil simulasi persona AI & evaluator — bukan data pembeli nyata."
        testId="stress-test-history-card"
      >
        {error ? (
          <ErrorState message="Riwayat run belum dapat dimuat." />
        ) : runs === undefined ? (
          <LoadingState processLabel="Memuat riwayat run…" />
        ) : runs.length === 0 ? (
          <EmptyState
            title="Belum ada simulasi."
            description="Jalankan uji ketahanan creative pertama: pilih listing atau campaign, persona pembeli, lalu lihat skor readiness, keberatan, dan rekomendasi perbaikannya di sini."
            action={
              <Link href="/samantha/stress-test/run" className={styles.primary}>
                Mulai Simulasi Pertama
              </Link>
            }
          />
        ) : (
          <>
            <SimulationRunFilters filters={filters} onChange={setFilters} />
            {page.filteredCount === 0 ? (
              <EmptyState
                compact
                title="Tidak ada run yang cocok"
                description="Ubah atau reset filter untuk melihat run lain."
              />
            ) : (
              <SimulationRunsTable rows={page.rows} onCompare={setCompareRunId} />
            )}
            <div className={historyStyles.pager} data-testid="simulation-runs-pager">
              <span>
                {page.filteredCount} dari {page.total} run · halaman {page.page}/{page.pageCount}
              </span>
              <div className={historyStyles.pagerControls}>
                <label
                  className={historyStyles.field}
                  style={{ flexDirection: "row", alignItems: "center" }}
                >
                  Per halaman
                  <select
                    className={historyStyles.select}
                    value={filters.pageSize}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        pageSize: Number(e.target.value) as PageSize,
                        page: 1,
                      })
                    }
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={historyStyles.btn}
                  disabled={page.page <= 1}
                  onClick={() => setFilters({ ...filters, page: page.page - 1 })}
                >
                  ‹ Sebelumnya
                </button>
                <button
                  type="button"
                  className={historyStyles.btn}
                  disabled={page.page >= page.pageCount}
                  onClick={() => setFilters({ ...filters, page: page.page + 1 })}
                >
                  Berikutnya ›
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
      {compareRun !== undefined ? (
        <CompareRunsDrawer open onClose={() => setCompareRunId(undefined)} current={compareRun} />
      ) : null}
    </main>
  );
}
