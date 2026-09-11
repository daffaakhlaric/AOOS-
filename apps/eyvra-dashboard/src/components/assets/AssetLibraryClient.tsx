"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { classifyAssetSource, type AssetSource } from "@/lib/assetSource";
import { formatDateTimeIdWib, formatNumber, formatRelativeTimeId } from "@/lib/formatters";
import type {
  AssetDownloadDto,
  AssetDto,
  AssetListDto,
  AssetStatsDto,
  AssetTypeDto,
} from "@/types/dashboard.types";
import type { Vertical } from "@/types/tenant.types";

import styles from "./AssetLibraryClient.module.css";

/**
 * CREATIVE HUB — real "source" filter tabs (Prompt 3's grid, scoped down to the honest 2-way
 * split; see `classifyAssetSource`'s doc for why the spec's literal 5 source buckets are
 * fabrications this codebase cannot back). "Kai" matches this app's own established convention
 * for naming the creative agent (`CreativeHubClient.tsx`'s "Brief ke Kai", `CreativePackageCard`'s
 * "Generate: Kai") rather than an English "AI Generated" label.
 */
const SOURCE_TABS: ReadonlyArray<{ readonly source?: AssetSource; readonly label: string }> = [
  { source: undefined, label: "Semua sumber" },
  { source: "MANUAL", label: "📤 Manual/Upload" },
  { source: "KAI", label: "✨ Kai" },
];

/** Real `Branch` enum members (`@aos/meta-ads-connector`'s `Branch.ts`). */
const BRANCHES = ["CINERE", "BINTARO", "BANDUNG", "JABODETABEK", "BOOST", "MULTI", "UMUM"] as const;

/**
 * The REAL `AssetType` union. "Semua" is the absence of a type filter, not an invented `ALL` member —
 * `aaos-api` validates this against the actual enum and 422s anything else.
 */
const TYPE_TABS: ReadonlyArray<{ readonly type?: AssetTypeDto; readonly label: string }> = [
  { type: undefined, label: "Semua" },
  { type: "UNIT_PHOTO", label: "📸 Foto Unit" },
  { type: "AI_VIDEO", label: "🎬 AI Video" },
  { type: "AI_IMAGE", label: "🖼 AI Image" },
  { type: "BRAND", label: "🏷 Brand" },
  { type: "TESTIMONIAL", label: "💬 Testimonial" },
  { type: "OVERLAY", label: "🧩 Overlay" },
];

const PAGE_LIMIT = 48;

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${formatNumber(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isVideo(asset: AssetDto): boolean {
  return asset.mimeType.startsWith("video/");
}

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
 * "Asset Library" (`/assets/library`) — AAOS-SCRAPER-ASSET-LIBRARY.
 *
 * Reads real `assets` rows exclusively through this app's own server-only `/api/assets*` proxy
 * routes (a `"use client"` component must never call `aaos-api` directly).
 *
 * DELIBERATE OMISSIONS — nothing in the backend produces these, so the card/detail UI shows nothing
 * rather than a fabricated value: image/video DIMENSIONS (`1920×1080`), video DURATION, an
 * `isMainPhoto` "⭐ jadikan foto utama" action, and the spec's "Dipakai di: #KAI-007 · #KAI-012"
 * usage list (no caller anywhere populates a `usedInPackages` field — wiring `creative-packages` to
 * record asset usage was out of scope for this pass). See `docs/REPORT-AAOS-SCRAPER-ASSET-LIBRARY.md`.
 *
 * The delete action is labelled "Arsipkan" because `DELETE /api/v1/assets/:id` calls the real
 * `ArchiveAsset` use case: it sets `AssetStatus.ARCHIVED` and KEEPS both the row and the GCS object.
 * There is no hard delete anywhere in this domain.
 *
 * SPRINT 5 PROMPT 14 FOLLOW-UP ("AI Suggested" badge) — STILL not rendered HERE, now for a
 * different, more fundamental real reason than before: `042_creative_packages_ai_recommended.sql`
 * closed gap (2) below — `creative_packages.ai_recommended` is now a real, persisted column,
 * threaded end-to-end from `PropertyManualBriefForm.tsx`'s Step 2 checkbox through
 * `PropertyCreatePackageBodySchema`/`createProperty` — so the flag itself is no longer fabricated or
 * missing. But gap (1) below turned out to hide a SECOND, structural gap discovered while wiring
 * this: a `PROPERTY` creative package's generated media never reaches this asset library's `assets`
 * table AT ALL — `creative-packages.service.ts`'s `persistGeneratedMedia`/`runGenerationProperty`
 * upload straight to GCS via the shared `IAssetStorage` adapter and deliberately bypass
 * `@aos/asset-library`'s `SaveAiCreative`/`assets` table entirely (that use case needs a real
 * `Branch` enum member, an AUTOMOTIVE-only concept a PROPERTY package has none of — see that
 * service's own "Finding 7" doc comment). `aiRecommended` can only ever be `true` on a `PROPERTY`
 * row (AUTOMOTIVE's `ManualBriefForm.tsx` has no recommendation logic), so the one real case this
 * badge exists for structurally never produces an `AssetDto` card here to badge. Rendering it on
 * this component would be dead code — always false, forever, by construction. The badge is instead
 * rendered on `CreativePackageCard.tsx` (`components/creative/`), the real place a PROPERTY package
 * — recommended or not — is actually shown to a human, where `pkg.aiRecommended` is real, live data.
 *
 * Original two gaps (both explain why the badge concept looked impossible before this follow-up):
 * (1) there is no WINNER/AVERAGE/LOW performance-badge concept ANYWHERE on this real `AssetDto` card
 * at all (only `AbTestingClient.tsx`, a completely different domain, has WINNER/AVERAGE-style
 * labels — this component computes none), and (2) `AssetDto`/`CreativePackageDto` carried no field
 * recording "was this brief's angle an accepted Kai recommendation" — now closed by (2) above.
 *
 * TENANT-SCOPING FIX, Phase T2 (docs/PROMPT-AAOS-TENANT-SCOPING-AND-PROPERTY-OBJECTIVE.md
 * Finding 2): `asset.branch` (`packages/asset-library`'s `Asset` entity) is a real, OPTIONAL
 * `Branch` value — the SAME AUTOMOTIVE-only dealer-branch enum `AreaPriority` uses — so a
 * PROPERTY tenant's real assets simply never set it. Rather than inventing a PROPERTY-equivalent
 * grouping with no real backing concept, the Branch filter/column is hidden entirely for PROPERTY
 * tenants (same client-side vertical resolution `Sidebar.tsx`/`CampaignTable.tsx` already use:
 * `GET /api/settings` → `tenant.vertical`, defaulting to showing the AUTOMOTIVE branch filter
 * until/unless the lookup resolves to `"PROPERTY"`, so there is never a flash of a missing filter
 * for the common AUTOMOTIVE case).
 *
 * CREATIVE HUB — "AdAdvisor-style" grid (pasted spec's Prompt 3): the real, honest "source" filter
 * tabs (`SOURCE_TABS`) and "✨ by Kai" badge were added HERE, in place, rather than as a new 5th
 * tab in `CreativeHubClient.tsx`. THIS component already IS the real asset grid rendered under
 * that hub's "Asset Library" tab — a second, parallel grid component would duplicate its KPI
 * strip/toolbar/pagination/detail-modal/archive flow wholesale for a feature that only adds one
 * more filter dimension on top of the same rows. The spec's literal 5 source buckets
 * ("Meta"/"Uploaded"/"Imported"/…) do not exist in this data model (see `classifyAssetSource`'s
 * doc) and per-creative ROAS/CPA/Spend/CTR are OMITTED entirely, not rendered as "Belum tersedia":
 * unlike `MetricsTab.tsx`'s campaign-level ROAS (which has a real, if disconnected, Meta-synced
 * spend number to honestly report as "not yet available"), there is no real link anywhere from an
 * `Asset`/`creativeBriefId` to a live ad's spend/CTR at all — not even a disconnected one — so
 * "Belum tersedia" would imply a metric this domain is one wire away from having, which it is not.
 */
export function AssetLibraryClient(): React.ReactElement {
  const [stats, setStats] = useState<AssetStatsDto | undefined>(undefined);
  const [statsError, setStatsError] = useState<string | undefined>(undefined);
  const [statsLoading, setStatsLoading] = useState(true);

  const [list, setList] = useState<AssetListDto | undefined>(undefined);
  const [listError, setListError] = useState<string | undefined>(undefined);
  const [listLoading, setListLoading] = useState(true);

  const [typeFilter, setTypeFilter] = useState<AssetTypeDto | undefined>(undefined);
  const [sourceFilter, setSourceFilter] = useState<AssetSource | undefined>(undefined);
  const [branchFilter, setBranchFilter] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<AssetDto | undefined>(undefined);
  const [actionError, setActionError] = useState<string | undefined>(undefined);
  const [actionPending, setActionPending] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  // Real vertical resolution — SAME client-side `GET /api/settings` → `tenant.vertical` fetch
  // `Sidebar.tsx` already uses; no second "who am I" call invented. Defaults to `undefined`
  // (unresolved → AUTOMOTIVE's branch filter shown), never a flash of the PROPERTY layout for the
  // common AUTOMOTIVE case, and a failed/pending fetch just keeps that default.
  const [vertical, setVertical] = useState<Vertical | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) =>
        res.ok ? (res.json() as Promise<{ tenant?: { vertical?: Vertical } }>) : null,
      )
      .then((data) => {
        if (!cancelled && data?.tenant?.vertical !== undefined) {
          setVertical(data.tenant.vertical);
        }
      })
      .catch(() => {
        // Best-effort only — a failed lookup keeps the branch filter shown, never breaks the page.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const isProperty = vertical === "PROPERTY";

  const loadStats = useCallback(async (): Promise<void> => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/assets/stats");
      const body: unknown = await res.json();
      if (!res.ok) {
        setStatsError(parseError(body, "Gagal memuat statistik asset."));
        return;
      }
      setStats(body as AssetStatsDto);
      setStatsError(undefined);
    } catch {
      setStatsError("Gagal memuat statistik asset.");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadList = useCallback(async (): Promise<void> => {
    setListLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT),
        sort,
      });
      if (typeFilter !== undefined) {
        params.set("type", typeFilter);
      }
      if (branchFilter !== undefined) {
        params.set("branch", branchFilter);
      }
      if (search !== undefined && search.length > 0) {
        params.set("search", search);
      }
      if (sourceFilter !== undefined) {
        params.set("source", sourceFilter);
      }
      const res = await fetch(`/api/assets?${params.toString()}`);
      const body: unknown = await res.json();
      if (!res.ok) {
        setListError(parseError(body, "Gagal memuat asset."));
        setList(undefined);
        return;
      }
      setList(body as AssetListDto);
      setListError(undefined);
    } catch {
      setListError("Gagal memuat asset.");
      setList(undefined);
    } finally {
      setListLoading(false);
    }
  }, [branchFilter, page, search, sort, sourceFilter, typeFilter]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function download(asset: AssetDto): Promise<void> {
    setActionPending(true);
    setActionError(undefined);
    try {
      const res = await fetch(`/api/assets/${encodeURIComponent(asset.id)}/download`);
      const body: unknown = await res.json();
      if (!res.ok) {
        setActionError(parseError(body, "Gagal membuat link download."));
        return;
      }
      const { url } = body as AssetDownloadDto;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setActionError("Gagal membuat link download.");
    } finally {
      setActionPending(false);
    }
  }

  /** Soft delete — see this component's doc note on why this is "Arsipkan", not a permanent delete. */
  async function archive(asset: AssetDto): Promise<void> {
    setActionPending(true);
    setActionError(undefined);
    try {
      const res = await fetch(`/api/assets/${encodeURIComponent(asset.id)}`, { method: "DELETE" });
      const body: unknown = await res.json();
      if (!res.ok) {
        setActionError(parseError(body, "Gagal mengarsipkan asset."));
        return;
      }
      setDetail(body as AssetDto);
      setConfirmArchive(false);
      await loadList();
      await loadStats();
    } catch {
      setActionError("Gagal mengarsipkan asset.");
    } finally {
      setActionPending(false);
    }
  }

  async function copyPath(asset: AssetDto): Promise<void> {
    try {
      await navigator.clipboard.writeText(asset.storagePath);
    } catch {
      setActionError("Clipboard tidak tersedia di browser ini.");
    }
  }

  const byType = stats?.byType ?? {};
  const byBranch = stats?.byBranch ?? {};
  const totalPages = list !== undefined ? Math.max(1, Math.ceil(list.total / list.limit)) : 1;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>🗂 Asset Library</h2>
          <p className={styles.subtitle}>
            Semua asset: foto unit dari scraper + hasil AI generate dari Kai.
          </p>
        </div>
      </div>

      {/* === KPI strip — real aggregate counts === */}
      <section data-testid="asset-kpi" className={styles.kpiStrip}>
        {statsLoading ? <LoadingSpinner /> : null}
        {!statsLoading && statsError !== undefined ? <ErrorCard message={statsError} /> : null}
        {!statsLoading && stats !== undefined ? (
          <>
            <Kpi label="TOTAL ASSET" value={formatNumber(stats.totalAssets)} />
            <Kpi label="FOTO UNIT" value={formatNumber(byType["UNIT_PHOTO"] ?? 0)} />
            <Kpi label="AI VIDEO" value={formatNumber(byType["AI_VIDEO"] ?? 0)} />
            <Kpi label="AI IMAGE" value={formatNumber(byType["AI_IMAGE"] ?? 0)} />
            <Kpi label="BRAND" value={formatNumber(byType["BRAND"] ?? 0)} />
            <Kpi label="UKURAN TOTAL" value={formatBytes(stats.totalSizeBytes)} />
          </>
        ) : null}
      </section>

      {/* === Toolbar === */}
      <div className={styles.toolbar}>
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setPage(1);
              setSearch(searchInput.trim().length > 0 ? searchInput.trim() : undefined);
            }
          }}
          placeholder="Cari asset (nama file)…"
          aria-label="Cari asset"
          className={styles.search}
        />
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setSearch(searchInput.trim().length > 0 ? searchInput.trim() : undefined);
          }}
          className={styles.secondaryButton}
        >
          Cari
        </button>

        {!isProperty ? (
          <>
            <label className={styles.inlineLabel} htmlFor="asset-branch">
              Cabang
            </label>
            <select
              id="asset-branch"
              value={branchFilter ?? ""}
              onChange={(event) => {
                setPage(1);
                setBranchFilter(event.target.value.length > 0 ? event.target.value : undefined);
              }}
              className={styles.select}
            >
              <option value="">Semua cabang</option>
              {BRANCHES.map((branch) => (
                <option key={branch} value={branch}>
                  {branch} ({formatNumber(byBranch[branch] ?? 0)})
                </option>
              ))}
            </select>
          </>
        ) : null}

        <label className={styles.inlineLabel} htmlFor="asset-sort">
          Urutkan
        </label>
        <select
          id="asset-sort"
          value={sort}
          onChange={(event) => {
            setPage(1);
            setSort(event.target.value === "oldest" ? "oldest" : "newest");
          }}
          className={styles.select}
        >
          <option value="newest">Terbaru</option>
          <option value="oldest">Terlama</option>
        </select>
      </div>

      {/* === Type filter tabs — counts from real stats === */}
      <div className={styles.tabs}>
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.type ?? "all"}
            type="button"
            onClick={() => {
              setPage(1);
              setTypeFilter(tab.type);
            }}
            className={`${styles.tab} ${typeFilter === tab.type ? styles.tabActive : ""}`}
          >
            {tab.label} (
            {formatNumber(
              tab.type === undefined ? (stats?.totalAssets ?? 0) : (byType[tab.type] ?? 0),
            )}
            )
          </button>
        ))}
      </div>

      {/* === Source filter tabs — real "Manual/Upload" vs "Kai" split, counts from real stats.
          `bySource` (see `AssetStatsDto`'s doc) is the honest replacement for the pasted spec's
          fabricated 5-way "Meta/Uploaded/Imported/…" split — see `classifyAssetSource`'s doc. === */}
      <div className={styles.tabs} data-testid="source-tabs">
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.source ?? "all"}
            type="button"
            onClick={() => {
              setPage(1);
              setSourceFilter(tab.source);
            }}
            className={`${styles.tab} ${sourceFilter === tab.source ? styles.tabActive : ""}`}
          >
            {tab.label} (
            {formatNumber(
              tab.source === undefined
                ? (stats?.totalAssets ?? 0)
                : (stats?.bySource?.[tab.source] ?? 0),
            )}
            )
          </button>
        ))}
      </div>

      {actionError !== undefined ? <ErrorCard message={actionError} /> : null}

      {/* === Asset grid === */}
      {listLoading ? <LoadingSpinner /> : null}
      {!listLoading && listError !== undefined ? <ErrorCard message={listError} /> : null}
      {!listLoading && listError === undefined && (list?.assets.length ?? 0) === 0 ? (
        sourceFilter === "KAI" ? (
          // Real empty state for the "Kai" source tab — links to the ALREADY-EXISTING real brief
          // entry point (`CreativeHubClient.tsx`'s "Brief ke Kai" button / `review-kai` tab's
          // "Buat Manual" flow), never a fabricated new one.
          <EmptyState
            title="Belum ada creative dari Kai"
            description="Kirim brief lewat Kai untuk generate video/gambar AI — hasilnya akan muncul di sini begitu selesai."
            action={
              <Link href="/creative?tab=review-kai" className={styles.primaryButton}>
                Brief ke Kai ↗
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="Belum ada asset"
            description={
              isProperty
                ? "Upload foto listing di Listing Manager, atau generate creative lewat Kai."
                : "Jalankan Scraper Mobix untuk mengambil foto unit, atau generate creative lewat Kai."
            }
          />
        )
      ) : null}

      {list !== undefined && list.assets.length > 0 ? (
        <>
          <div data-testid="asset-grid" className={styles.grid}>
            {list.assets.map((asset) => (
              <article key={asset.id} className={styles.card}>
                <button
                  type="button"
                  onClick={() => {
                    setDetail(asset);
                    setConfirmArchive(false);
                  }}
                  className={styles.thumbButton}
                  aria-label={`Buka detail ${asset.fileName}`}
                >
                  {isVideo(asset) ? (
                    <span className={styles.videoPlaceholder}>🎬</span>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element -- remote GCS URLs are not
                       configured as a next/image remote pattern in this app. */
                    <img src={asset.publicUrl} alt={asset.fileName} className={styles.thumb} />
                  )}
                </button>
                <div className={styles.badgeRow}>
                  <span className={styles.typeBadge}>{asset.type}</span>
                  {classifyAssetSource(asset) === "KAI" ? (
                    // Real generation-source badge — distinct from `CreativePackageCard.tsx`'s
                    // "✨ AI Suggested" badge (which means "used Kai's recommended angle", a
                    // different real concept). This one is real, direct `aiModel`/`creativeBriefId`
                    // presence — "this file was actually produced by Kai's pipeline".
                    <span data-testid="by-kai-badge" className={styles.byKaiBadge}>
                      ✨ by Kai
                    </span>
                  ) : null}
                </div>
                <p className={styles.cardTitle}>{asset.fileName}</p>
                {asset.unitModel !== undefined ? (
                  <p className={styles.cardMeta}>
                    {asset.unitModel}
                    {asset.unitYear !== undefined ? ` ${String(asset.unitYear)}` : ""}
                  </p>
                ) : null}
                <p className={styles.cardMeta}>
                  {isProperty
                    ? formatBytes(asset.fileSize)
                    : `${asset.branch ?? "—"} · ${formatBytes(asset.fileSize)}`}
                </p>
                {asset.aiModel !== undefined ? (
                  <p className={styles.cardMeta}>{asset.aiModel}</p>
                ) : null}
                <p className={styles.cardMeta}>{formatRelativeTimeId(asset.createdAt)}</p>
                {asset.status !== "ACTIVE" ? (
                  <p className={styles.statusBadge}>{asset.status}</p>
                ) : null}
              </article>
            ))}
          </div>

          <div className={styles.pager}>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className={styles.secondaryButton}
            >
              ← Sebelumnya
            </button>
            <span className={styles.mutedText}>
              Halaman {formatNumber(list.page)} dari {formatNumber(totalPages)} ·{" "}
              {formatNumber(list.total)} asset
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={page >= totalPages}
              className={styles.secondaryButton}
            >
              Berikutnya →
            </button>
          </div>
        </>
      ) : null}

      {/* === Asset detail modal === */}
      {detail !== undefined ? (
        <div
          role="dialog"
          aria-label="Detail asset"
          data-testid="asset-detail"
          className={styles.modalBackdrop}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.sectionTitle}>{detail.fileName}</h3>
              <button
                type="button"
                onClick={() => {
                  setDetail(undefined);
                  setConfirmArchive(false);
                }}
                className={styles.secondaryButton}
              >
                Tutup
              </button>
            </div>

            {isVideo(detail) ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption -- user-uploaded/AI-generated marketing footage has no caption track.
              <video src={detail.publicUrl} controls className={styles.preview} />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element -- see the grid's note. */
              <img src={detail.publicUrl} alt={detail.fileName} className={styles.preview} />
            )}

            <dl className={styles.detailGrid}>
              <Detail label="Tipe" value={detail.type} />
              <Detail label="Status" value={detail.status} />
              {detail.unitModel !== undefined ? (
                <Detail
                  label="Unit"
                  value={`${detail.unitModel}${detail.unitYear !== undefined ? ` ${String(detail.unitYear)}` : ""}`}
                />
              ) : null}
              {detail.unitId !== undefined ? (
                <Detail label="Unit ID" value={detail.unitId} />
              ) : null}
              {!isProperty && detail.branch !== undefined ? (
                <Detail label="Cabang" value={detail.branch} />
              ) : null}
              <Detail label="Ukuran" value={formatBytes(detail.fileSize)} />
              <Detail label="MIME" value={detail.mimeType} />
              <Detail label="GCS path" value={detail.storagePath} />
              {detail.aiModel !== undefined ? (
                <Detail label="Model AI" value={detail.aiModel} />
              ) : null}
              {detail.creativeBriefId !== undefined ? (
                <Detail label="Creative brief" value={detail.creativeBriefId} />
              ) : null}
              <Detail label="Dibuat" value={formatDateTimeIdWib(detail.createdAt)} />
              {detail.tags.length > 0 ? (
                <Detail label="Tags" value={detail.tags.join(", ")} />
              ) : null}
            </dl>

            {detail.aiPrompt !== undefined ? (
              <>
                <h4 className={styles.sectionTitle}>Prompt AI</h4>
                <p className={styles.mutedText}>{detail.aiPrompt}</p>
              </>
            ) : null}

            <div className={styles.cardActions}>
              <button
                type="button"
                onClick={() => void download(detail)}
                disabled={actionPending}
                className={styles.primaryButton}
              >
                ⬇ Download
              </button>
              <button
                type="button"
                onClick={() => void copyPath(detail)}
                className={styles.secondaryButton}
              >
                📋 Copy GCS path
              </button>
              {detail.status !== "ARCHIVED" ? (
                confirmArchive ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void archive(detail)}
                      disabled={actionPending}
                      className={styles.dangerButton}
                    >
                      Ya, arsipkan
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmArchive(false)}
                      className={styles.secondaryButton}
                    >
                      Batal
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmArchive(true)}
                    className={styles.secondaryButton}
                  >
                    🗄 Arsipkan
                  </button>
                )
              ) : null}
            </div>
            <p className={styles.mutedText}>
              &ldquo;Arsipkan&rdquo; menandai asset sebagai ARCHIVED — file di Google Cloud Storage
              dan datanya tetap disimpan untuk riwayat. Tidak ada hapus permanen.
            </p>
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

function Detail({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.ReactElement {
  return (
    <div className={styles.detailRow}>
      <dt className={styles.detailLabel}>{label}</dt>
      <dd className={styles.detailValue}>{value}</dd>
    </div>
  );
}
