"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatIdrCompact, formatNumber, formatRelativeTimeId } from "@/lib/formatters";
import type {
  AssetDto,
  ScrapedUnitDto,
  ScrapeJobDto,
  ScraperStatusDto,
  StockListDto,
} from "@/types/dashboard.types";

import styles from "./ScraperClient.module.css";

/** Real `Branch` enum members (`@aos/meta-ads-connector`'s `Branch.ts`) — never a fabricated branch. */
const BRANCHES = ["CINERE", "BINTARO", "BANDUNG", "JABODETABEK", "BOOST", "MULTI", "UMUM"] as const;

/** Fallback poll interval for a running job, used only if the SSE stream cannot be opened. */
const JOB_POLL_INTERVAL_MS = 2000;
const STOCK_PAGE_LIMIT = 60;

function parseError(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = (body as { error?: { message?: unknown } }).error;
    if (error !== undefined && typeof error.message === "string") {
      return error.message;
    }
  }
  return fallback;
}

/**
 * "Scraper Mobix" (`/assets/scraper`) — AAOS-SCRAPER-ASSET-LIBRARY.
 *
 * Every number rendered here comes from a real `aaos-api` response, reached ONLY through this app's
 * own server-only `/api/scraper/*` proxy routes (a `"use client"` component must never call
 * `aaos-api` directly). The KPI strip and unit grid read the durable `scraped_units` table; the
 * progress modal renders real `scrape_job_logs` rows, streamed over the real SSE endpoint via
 * `/api/scraper/jobs/:jobId/stream` (proxied server-side because the browser's `EventSource` cannot
 * send the `x-api-key` header `ApiKeyGuard` requires), with a plain poll of
 * `/api/scraper/jobs/:jobId` as the fallback if that stream cannot be opened.
 *
 * HONEST BUTTON COPY: "Scrape Semua Ulang" re-parses the whole mobixbydss.id listing (refreshing
 * every unit's price/km/availability) but does NOT re-download photos for units already ingested —
 * that is the real, deliberate behavior of `RunFullScrape`, and the subtitle says so. Per-unit
 * "Scrape ulang unit ini" DOES always re-ingest that one unit's photos.
 */
export function ScraperClient(): React.ReactElement {
  const [status, setStatus] = useState<ScraperStatusDto | undefined>(undefined);
  const [statusError, setStatusError] = useState<string | undefined>(undefined);
  const [statusLoading, setStatusLoading] = useState(true);

  const [stock, setStock] = useState<StockListDto | undefined>(undefined);
  const [stockError, setStockError] = useState<string | undefined>(undefined);
  const [stockLoading, setStockLoading] = useState(true);

  const [branchFilter, setBranchFilter] = useState<string | undefined>(undefined);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState<string | undefined>(undefined);

  const [job, setJob] = useState<ScrapeJobDto | undefined>(undefined);
  const [jobId, setJobId] = useState<string | undefined>(undefined);
  const [jobError, setJobError] = useState<string | undefined>(undefined);
  const [starting, setStarting] = useState(false);

  const [detailUnit, setDetailUnit] = useState<ScrapedUnitDto | undefined>(undefined);
  const [detailAssets, setDetailAssets] = useState<readonly AssetDto[] | undefined>(undefined);
  const [detailAssetsError, setDetailAssetsError] = useState<string | undefined>(undefined);

  const sourceRef = useRef<EventSource | undefined>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const loadStatus = useCallback(async (): Promise<void> => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/scraper/status");
      const body: unknown = await res.json();
      if (!res.ok) {
        setStatusError(parseError(body, "Gagal memuat status scraper."));
        return;
      }
      setStatus(body as ScraperStatusDto);
      setStatusError(undefined);
    } catch {
      setStatusError("Gagal memuat status scraper.");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadStock = useCallback(async (): Promise<void> => {
    setStockLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", limit: String(STOCK_PAGE_LIMIT) });
      if (branchFilter !== undefined) {
        params.set("branch", branchFilter);
      }
      if (search !== undefined && search.length > 0) {
        params.set("search", search);
      }
      const res = await fetch(`/api/scraper/stock?${params.toString()}`);
      const body: unknown = await res.json();
      if (!res.ok) {
        setStockError(parseError(body, "Gagal memuat daftar unit."));
        setStock(undefined);
        return;
      }
      setStock(body as StockListDto);
      setStockError(undefined);
    } catch {
      setStockError("Gagal memuat daftar unit.");
      setStock(undefined);
    } finally {
      setStockLoading(false);
    }
  }, [branchFilter, search]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    void loadStock();
  }, [loadStock]);

  /** Tears down whichever progress transport is currently active. */
  const stopWatching = useCallback((): void => {
    sourceRef.current?.close();
    sourceRef.current = undefined;
    if (pollRef.current !== undefined) {
      clearInterval(pollRef.current);
      pollRef.current = undefined;
    }
  }, []);

  // Watches a running job: real SSE first (via this app's own proxy route), falling back to polling
  // the same persisted state if the stream errors out (e.g. a proxy that buffers event streams).
  useEffect(() => {
    if (jobId === undefined) {
      return;
    }

    async function pollOnce(): Promise<void> {
      try {
        const res = await fetch(`/api/scraper/jobs/${jobId}`);
        const body: unknown = await res.json();
        if (!res.ok) {
          setJobError(parseError(body, "Gagal memuat status job."));
          return;
        }
        const next = body as ScrapeJobDto;
        setJob(next);
        if (next.status !== "RUNNING") {
          stopWatching();
          void loadStatus();
          void loadStock();
        }
      } catch {
        setJobError("Gagal memuat status job.");
      }
    }

    function startPolling(): void {
      if (pollRef.current !== undefined) {
        return;
      }
      void pollOnce();
      pollRef.current = setInterval(() => void pollOnce(), JOB_POLL_INTERVAL_MS);
    }

    // `EventSource` is absent in the jsdom test environment (and in any non-browser runtime), so the
    // polling fallback is also the code path component tests exercise.
    if (typeof EventSource === "undefined") {
      startPolling();
      return stopWatching;
    }

    const source = new EventSource(`/api/scraper/jobs/${jobId}/stream`);
    sourceRef.current = source;
    source.onmessage = (event: MessageEvent<string>) => {
      try {
        const next = JSON.parse(event.data) as ScrapeJobDto;
        setJob(next);
        setJobError(undefined);
        if (next.status !== "RUNNING") {
          stopWatching();
          void loadStatus();
          void loadStock();
        }
      } catch {
        setJobError("Frame progress tidak bisa dibaca.");
      }
    };
    source.onerror = () => {
      // The stream also "errors" on a normal server-side close after the job finishes; polling once
      // more settles which of the two happened without guessing.
      source.close();
      sourceRef.current = undefined;
      startPolling();
    };

    return stopWatching;
  }, [jobId, loadStatus, loadStock, stopWatching]);

  async function startScrape(unitUrl?: string): Promise<void> {
    setStarting(true);
    setJobError(undefined);
    stopWatching();
    try {
      const res = await fetch("/api/scraper/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(unitUrl !== undefined ? { unitUrl } : {}),
      });
      const body: unknown = await res.json();
      if (!res.ok) {
        setJobError(parseError(body, "Gagal memulai scrape."));
        return;
      }
      const started = body as { jobId: string };
      setJob(undefined);
      setJobId(started.jobId);
    } catch {
      setJobError("Gagal memulai scrape.");
    } finally {
      setStarting(false);
    }
  }

  async function openDetail(unit: ScrapedUnitDto): Promise<void> {
    setDetailUnit(unit);
    setDetailAssets(undefined);
    setDetailAssetsError(undefined);
    try {
      const res = await fetch(
        `/api/assets?unitId=${encodeURIComponent(unit.unitId)}&type=UNIT_PHOTO&limit=48`,
      );
      const body: unknown = await res.json();
      if (!res.ok) {
        setDetailAssetsError(parseError(body, "Gagal memuat foto tersimpan."));
        return;
      }
      setDetailAssets((body as { assets: readonly AssetDto[] }).assets);
    } catch {
      setDetailAssetsError("Gagal memuat foto tersimpan.");
    }
  }

  function applySearch(): void {
    setSearch(searchInput.trim().length > 0 ? searchInput.trim() : undefined);
  }

  const branchCounts = status?.byBranch ?? {};
  const jobRunning = job?.status === "RUNNING" || (jobId !== undefined && job === undefined);

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>📸 Scraper Mobix</h2>
          <p className={styles.subtitle}>
            Ambil data & foto unit dari mobixbydss.id → simpan ke Google Cloud Storage.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={() => void startScrape()}
            disabled={starting || jobRunning}
            className={styles.primaryButton}
          >
            {starting ? "Memulai…" : "🔄 Scrape Semua Ulang"}
          </button>
        </div>
      </div>
      <p className={styles.mutedText}>
        Cek unit baru &amp; update listing (harga, KM, ketersediaan). Foto unit yang sudah pernah
        diunduh tidak diunduh ulang — gunakan &ldquo;Scrape ulang unit ini&rdquo; pada satu unit
        untuk itu.
      </p>

      {/*
        Rendered at page level, not only inside the progress modal: a failure to START a job means
        there is no `jobId` and therefore no modal to show the error in — leaving the user staring at
        an unchanged page with no feedback (a real bug this component's own test caught).
      */}
      {jobError !== undefined && jobId === undefined ? <ErrorCard message={jobError} /> : null}

      {/* === KPI strip === */}
      <section data-testid="scraper-kpi" className={styles.kpiStrip}>
        {statusLoading ? <LoadingSpinner /> : null}
        {!statusLoading && statusError !== undefined ? <ErrorCard message={statusError} /> : null}
        {!statusLoading && status !== undefined ? (
          <>
            <Kpi label="UNIT" value={formatNumber(status.totalUnits)} />
            <Kpi label="TERSEDIA" value={formatNumber(status.availableUnits)} />
            <Kpi label="FOTO (LISTING)" value={formatNumber(status.totalPhotos)} />
            <Kpi label="CABANG" value={formatNumber(Object.keys(branchCounts).length)} />
            <Kpi
              label="TERAKHIR SCRAPE"
              value={
                status.lastScrapedAt !== undefined
                  ? formatRelativeTimeId(status.lastScrapedAt)
                  : "Belum pernah"
              }
            />
          </>
        ) : null}
      </section>

      {status?.lastJob !== undefined ? (
        <p data-testid="scraper-last-job" className={styles.mutedText}>
          Status terakhir: <strong>{status.lastJob.status}</strong> ·{" "}
          {status.lastJob.kind === "FULL" ? "seluruh listing" : "satu unit"} ·{" "}
          {status.lastJob.result !== undefined
            ? `${formatNumber(status.lastJob.result.unitsScraped)} unit, ${formatNumber(
                status.lastJob.result.photosStored,
              )} foto tersimpan`
            : (status.lastJob.errorMessage ?? "sedang berjalan")}
        </p>
      ) : null}

      {/* === Toolbar === */}
      <div className={styles.toolbar}>
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              applySearch();
            }
          }}
          placeholder="Cari unit (model)…"
          aria-label="Cari unit"
          className={styles.search}
        />
        <button type="button" onClick={applySearch} className={styles.secondaryButton}>
          Cari
        </button>
      </div>

      {/* === Branch filter tabs — counts come from real persisted stock === */}
      <div className={styles.tabs}>
        <button
          type="button"
          onClick={() => setBranchFilter(undefined)}
          className={`${styles.tab} ${branchFilter === undefined ? styles.tabActive : ""}`}
        >
          Semua ({formatNumber(status?.totalUnits ?? 0)})
        </button>
        {BRANCHES.filter((branch) => (branchCounts[branch] ?? 0) > 0).map((branch) => (
          <button
            key={branch}
            type="button"
            onClick={() => setBranchFilter(branch)}
            className={`${styles.tab} ${branchFilter === branch ? styles.tabActive : ""}`}
          >
            {branch} ({formatNumber(branchCounts[branch] ?? 0)})
          </button>
        ))}
      </div>

      {/* === Unit grid === */}
      {stockLoading ? <LoadingSpinner /> : null}
      {!stockLoading && stockError !== undefined ? <ErrorCard message={stockError} /> : null}
      {!stockLoading && stockError === undefined && (stock?.units.length ?? 0) === 0 ? (
        <EmptyState
          title="Belum ada unit tersimpan"
          description="Jalankan “Scrape Semua Ulang” untuk mengambil listing mobixbydss.id."
        />
      ) : null}

      {stock !== undefined && stock.units.length > 0 ? (
        <div data-testid="scraper-unit-grid" className={styles.grid}>
          {stock.units.map((unit) => (
            <article key={unit.unitId} className={styles.card}>
              <h3 className={styles.cardTitle}>
                {unit.brand} {unit.model} {unit.year}
              </h3>
              <p className={styles.cardMeta}>
                {unit.transmission} · {unit.color}
              </p>
              <p className={styles.cardPrice}>
                {formatIdrCompact(unit.priceIdr)} · {formatNumber(unit.kilometer)} km
              </p>
              <p className={styles.cardMeta}>
                {unit.branch} · {unit.available ? "Tersedia" : "Tidak tersedia"}
              </p>
              <p className={styles.cardMeta}>
                {formatNumber(unit.photoCount)} foto · {formatRelativeTimeId(unit.scrapedAt)}
              </p>
              <div className={styles.cardActions}>
                <button
                  type="button"
                  onClick={() => void openDetail(unit)}
                  className={styles.secondaryButton}
                >
                  Lihat foto
                </button>
                <button
                  type="button"
                  onClick={() => void startScrape(unit.url)}
                  disabled={starting || jobRunning}
                  className={styles.secondaryButton}
                >
                  Scrape ulang
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {/* === Progress modal === */}
      {jobId !== undefined ? (
        <div
          role="dialog"
          aria-label="Progress scrape"
          data-testid="scrape-progress"
          className={styles.modalBackdrop}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.sectionTitle}>
                {jobRunning ? "🔄 Scraping mobixbydss.id…" : "Hasil scrape"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  stopWatching();
                  setJobId(undefined);
                  setJob(undefined);
                }}
                className={styles.secondaryButton}
              >
                Tutup
              </button>
            </div>

            {jobError !== undefined ? <ErrorCard message={jobError} /> : null}
            {job === undefined ? <LoadingSpinner /> : null}

            {job !== undefined ? (
              <>
                <p className={styles.progressLabel}>
                  {job.progressTotal !== undefined
                    ? `${formatNumber(job.progressCurrent)}/${formatNumber(job.progressTotal)} unit`
                    : "Menunggu listing diparse…"}
                </p>
                {/* Indeterminate until the listing is really parsed — no fabricated denominator. */}
                {job.progressTotal !== undefined && job.progressTotal > 0 ? (
                  <div className={styles.progressTrack}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${String(
                          Math.min(
                            100,
                            Math.round((job.progressCurrent / job.progressTotal) * 100),
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                ) : null}

                <div className={styles.logPanel}>
                  {job.logs.map((entry, index) => (
                    <p
                      key={`${entry.createdAt}-${String(index)}`}
                      className={`${styles.logLine} ${
                        entry.level === "WARN"
                          ? styles.logLineWarn
                          : entry.level === "ERROR"
                            ? styles.logLineError
                            : ""
                      }`}
                    >
                      [{new Date(entry.createdAt).toLocaleTimeString("id-ID")}] {entry.message}
                    </p>
                  ))}
                </div>

                {job.result !== undefined ? (
                  <p className={styles.rowText}>
                    Selesai: {formatNumber(job.result.unitsScraped)} unit ·{" "}
                    {formatNumber(job.result.newUnits)} baru ·{" "}
                    {formatNumber(job.result.photosStored)} foto tersimpan
                    {job.result.photosFailed > 0
                      ? ` · ${formatNumber(job.result.photosFailed)} foto gagal`
                      : ""}
                  </p>
                ) : null}
                {job.status === "ERROR" ? (
                  <ErrorCard message={job.errorMessage ?? "Scrape gagal."} />
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* === Unit detail modal === */}
      {detailUnit !== undefined ? (
        <div
          role="dialog"
          aria-label="Detail unit"
          data-testid="unit-detail"
          className={styles.modalBackdrop}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.sectionTitle}>
                {detailUnit.brand} {detailUnit.model} {detailUnit.year} · {detailUnit.branch}
              </h3>
              <button
                type="button"
                onClick={() => setDetailUnit(undefined)}
                className={styles.secondaryButton}
              >
                Tutup
              </button>
            </div>

            <p className={styles.rowText}>
              Harga: {formatIdrCompact(detailUnit.priceIdr)} · KM:{" "}
              {formatNumber(detailUnit.kilometer)} · Warna: {detailUnit.color} · Transmisi:{" "}
              {detailUnit.transmission}
            </p>
            <p className={styles.mutedText}>
              <a href={detailUnit.url} target="_blank" rel="noreferrer" className={styles.link}>
                {detailUnit.url}
              </a>
            </p>

            <h4 className={styles.sectionTitle}>Foto tersimpan di GCS</h4>
            {detailAssetsError !== undefined ? <ErrorCard message={detailAssetsError} /> : null}
            {detailAssets === undefined && detailAssetsError === undefined ? (
              <LoadingSpinner />
            ) : null}
            {detailAssets !== undefined && detailAssets.length === 0 ? (
              <p className={styles.mutedText}>
                Belum ada foto unit ini yang tersimpan di GCS. Jalankan &ldquo;Scrape ulang&rdquo;
                pada unit ini.
              </p>
            ) : null}
            {detailAssets !== undefined && detailAssets.length > 0 ? (
              <div className={styles.photoGrid}>
                {detailAssets.map((asset) => (
                  <a
                    key={asset.id}
                    href={asset.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.photoTile}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote GCS URLs are not
                        configured as a next/image remote pattern in this app, and adding one would be
                        an unrelated build-config change. */}
                    <img src={asset.publicUrl} alt={asset.fileName} className={styles.photo} />
                  </a>
                ))}
              </div>
            ) : null}

            <div className={styles.cardActions}>
              <button
                type="button"
                onClick={() => void startScrape(detailUnit.url)}
                disabled={starting || jobRunning}
                className={styles.primaryButton}
              >
                🔄 Scrape ulang unit ini
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.ReactElement {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value}</span>
    </div>
  );
}
