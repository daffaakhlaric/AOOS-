"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MetricCard } from "@/components/analytics/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatIdr, formatNumber, formatPercent } from "@/lib/formatters";
import type { AbTestDto, AbTestVariantDto } from "@/types/dashboard.types";

import styles from "./AbTestingClient.module.css";
import { CreateAbTestModal } from "./CreateAbTestModal";

type Tab = "RUNNING" | "COMPLETE" | "DRAFT";

const TAB_LABEL: Readonly<Record<Tab, string>> = {
  RUNNING: "Aktif",
  COMPLETE: "Selesai",
  DRAFT: "Draft",
};

/** Real (never fabricated) Rp/lead for a variant — `undefined` until leads exist, matching `Rph`'s own "no rate available" semantics upstream. */
function formatRphLead(rphLead: number | undefined): string {
  return rphLead === undefined ? "—" : formatIdr(rphLead);
}

function variantStatusLabel(status: string): string {
  switch (status) {
    case "WINNER":
      return "🏆 WINNER";
    case "PAUSED_LOSER":
      return "⏸ PAUSED";
    case "RUNNING":
      return "🟢 RUNNING";
    case "READY":
      return "⏳ SIAP LAUNCH";
    case "PENDING_CREATIVE":
      return "🎨 GENERATE CREATIVE";
    case "FAILED":
      return "❌ GAGAL";
    default:
      return status;
  }
}

function bestVariant(variants: readonly AbTestVariantDto[]): AbTestVariantDto | undefined {
  const withRate = variants.filter((v) => v.rphLead !== undefined);
  if (withRate.length === 0) {
    return undefined;
  }
  return [...withRate].sort((a, b) => (a.rphLead ?? 0) - (b.rphLead ?? 0))[0];
}

/**
 * Real progress toward `isThresholdMet`'s own real gate (`aaos-api`'s
 * `domain/winner-decision.ts`) — combined spend across every real variant vs. `thresholdSpend`,
 * OR real days elapsed since `startedAt` vs. `thresholdDays`, whichever is closer to done. Mirrors
 * the backend's exact `OR` semantics rather than inventing a separate "confidence%" this app has
 * no real backing data for. `undefined` for a test with no `startedAt` yet (DRAFT) — never a
 * fabricated 0%.
 */
function thresholdProgressPct(test: AbTestDto): number | undefined {
  if (test.startedAt === undefined) {
    return undefined;
  }
  const totalSpend = test.variants.reduce((sum, variant) => sum + variant.spend, 0);
  const daysElapsed = (Date.now() - new Date(test.startedAt).getTime()) / 86_400_000;
  const spendProgress = test.thresholdSpend > 0 ? totalSpend / test.thresholdSpend : 0;
  const daysProgress = test.thresholdDays > 0 ? daysElapsed / test.thresholdDays : 0;
  return Math.min(100, Math.round(Math.max(spendProgress, daysProgress, 0) * 100));
}

/**
 * `/meta-ads/abtesting` (AAOS-ABTESTING-LOOKALIKE) — Samantha's auto A/B test creative page. 3 tabs
 * (Aktif/Selesai/Draft) + a real KPI strip + "+ Buat A/B Test Baru" modal, all backed by
 * `aaos-api`'s real `abtesting` module via this app's own `/api/abtesting/*` proxy routes.
 *
 * KPI strip deviates from the spec's literal 4 cells: "BUDGET DIHEMAT" has no honest baseline to
 * compute against anywhere in this app's real data (there's no "what would have been spent without
 * A/B testing" counterfactual) — never fabricated here. "AVG IMPROVEMENT" (real, from COMPLETE
 * tests' own `improvementPct`) and "DRAFT MENUNGGU" (real, count of DRAFT tests) are shown instead.
 */
export function AbTestingClient(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("RUNNING");
  const [tests, setTests] = useState<readonly AbTestDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pausingId, setPausingId] = useState<string | undefined>(undefined);
  // AdAdvisor-style rebuild (user-reported gap: "di creative ab testing asset image/video gabisa
  // di render"): the variant grid is now a simple thumbnail-card grid — clicking a card opens this
  // real detail view instead of the old always-expanded text-only column.
  const [openVariant, setOpenVariant] = useState<AbTestVariantDto | undefined>(undefined);

  const loadTests = useCallback(() => {
    fetch("/api/abtesting")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat data A/B test.");
        }
        return (await res.json()) as { tests: readonly AbTestDto[] };
      })
      .then((body) => setTests(body.tests))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat data A/B test.");
      });
  }, []);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  async function handlePause(id: string): Promise<void> {
    setPausingId(id);
    try {
      const response = await fetch(`/api/abtesting/${id}/pause`, { method: "POST" });
      if (response.ok) {
        loadTests();
      }
    } finally {
      setPausingId(undefined);
    }
  }

  const kpi = useMemo(() => {
    const all = tests ?? [];
    const active = all.filter((t) => t.status === "RUNNING").length;
    const completed = all.filter((t) => t.status === "COMPLETE");
    const draft = all.filter((t) => t.status === "DRAFT").length;
    const avgImprovement =
      completed.length === 0
        ? undefined
        : Math.round(
            completed.reduce((sum, t) => sum + (t.improvementPct ?? 0), 0) / completed.length,
          );
    return { active, winners: completed.length, draft, avgImprovement };
  }, [tests]);

  const filtered = useMemo(() => (tests ?? []).filter((t) => t.status === tab), [tests, tab]);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>A/B Testing</h2>
          <p className={styles.subtitle}>
            Samantha otomatis buat dan monitor variasi iklan terbaik
          </p>
        </div>
      </div>

      <div className={styles.kpiStrip} data-testid="abtesting-kpi-strip">
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>TEST AKTIF</p>
          <p className={styles.kpiValue}>{kpi.active}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>WINNER DITEMUKAN</p>
          <p className={styles.kpiValue}>{kpi.winners}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>DRAFT MENUNGGU</p>
          <p className={styles.kpiValue}>{kpi.draft}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>AVG IMPROVEMENT</p>
          <p className={styles.kpiValue}>
            {kpi.avgImprovement === undefined ? "—" : `${String(kpi.avgImprovement)}%`}
          </p>
        </div>
      </div>

      <div className={styles.poolActionsRow}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => setShowCreateModal(true)}
        >
          + Buat A/B Test Baru
        </button>
      </div>

      <div className={styles.tabRow} role="tablist">
        {(["RUNNING", "COMPLETE", "DRAFT"] as const).map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            role="tab"
            aria-selected={tab === tabKey}
            className={tab === tabKey ? styles.tabActive : styles.tab}
            onClick={() => setTab(tabKey)}
          >
            {TAB_LABEL[tabKey]} ({(tests ?? []).filter((t) => t.status === tabKey).length})
          </button>
        ))}
      </div>

      {tests === undefined ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🔬"
          title={`Tidak ada test ${TAB_LABEL[tab].toLowerCase()}`}
          description="Buat A/B test baru untuk mulai membandingkan variasi iklan."
        />
      ) : (
        <div className={styles.cardList} data-testid="abtesting-card-list">
          {filtered.map((test) => {
            const winner =
              test.winnerVariantId !== undefined
                ? test.variants.find((v) => v.id === test.winnerVariantId)
                : bestVariant(test.variants);
            const progressPct = test.status === "RUNNING" ? thresholdProgressPct(test) : undefined;
            return (
              <div key={test.id} className={styles.card} data-testid="abtesting-card">
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>
                    🔬 {test.name} — {test.variants.length} Variant
                  </span>
                  <span className={styles.cardStatus}>
                    {test.status === "RUNNING"
                      ? "🟢 RUNNING"
                      : test.status === "COMPLETE"
                        ? "✅ SELESAI"
                        : test.status === "FAILED"
                          ? "❌ GAGAL"
                          : "📝 DRAFT"}
                  </span>
                </div>

                {progressPct !== undefined ? (
                  <div className={styles.progressRow} data-testid="abtesting-progress">
                    <div className={styles.progressTrack}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${String(progressPct)}%` }}
                      />
                    </div>
                    <span className={styles.progressLabel}>
                      {progressPct}% menuju threshold ({formatIdr(test.thresholdSpend)} /{" "}
                      {test.thresholdDays} hari)
                    </span>
                  </div>
                ) : null}

                <div className={styles.variantGrid}>
                  {test.variants.map((variant) => (
                    <VariantCard
                      key={variant.id}
                      variant={variant}
                      onOpen={() => setOpenVariant(variant)}
                    />
                  ))}
                </div>

                {test.status === "COMPLETE" && winner !== undefined ? (
                  <p className={styles.samanthaNote}>
                    Samantha: &quot;Variant {winner.variantLabel} menang
                    {test.improvementPct !== undefined
                      ? ` dengan Rp/lead ${String(test.improvementPct)}% lebih murah.`
                      : "."}{" "}
                    {test.autoPauseLoser ? "Loser di-pause." : ""}{" "}
                    {test.autoScaleWinner ? "Winner di-scale +20%." : ""}&quot;
                  </p>
                ) : null}

                {test.status === "RUNNING" ? (
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.linkButton}
                      disabled={pausingId === test.id}
                      onClick={() => void handlePause(test.id)}
                    >
                      {pausingId === test.id ? "Mem-pause..." : "⏸ Pause Test"}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal ? (
        <CreateAbTestModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadTests();
          }}
        />
      ) : null}

      {openVariant !== undefined ? (
        <VariantDetailModal variant={openVariant} onClose={() => setOpenVariant(undefined)} />
      ) : null}
    </div>
  );
}

/**
 * AdAdvisor-style simple thumbnail card — same real card recipe `WinningCombos.tsx` already
 * establishes (thumbnail + type badge + name + a lean CTR/Spend/Impressions row), applied here to
 * one A/B-test variant instead of one heatmap cell. Real media only: `variant.imageUrl`/`videoUrl`
 * (resolved server-side from this variant's own real `creativePackageId`, see
 * `AbTestVariantDto`'s own doc) renders as a real `<img>`/`<video>` poster; an honest 🖼/🎬
 * placeholder icon renders instead when no real media is available yet (still generating, or the
 * package was deleted) — never a fabricated image.
 */
function VariantCard({
  variant,
  onOpen,
}: {
  readonly variant: AbTestVariantDto;
  readonly onOpen: () => void;
}): React.ReactElement {
  const hasRealMedia = variant.imageUrl !== undefined || variant.videoUrl !== undefined;
  return (
    <button
      type="button"
      data-testid={`variant-card-${variant.id}`}
      className={styles.variantCard}
      onClick={onOpen}
    >
      <div className={styles.variantThumb}>
        <span className={styles.variantTypeBadge}>
          {variant.assetKind === "VIDEO" ? "Video" : "Image"}
        </span>
        {hasRealMedia ? (
          variant.assetKind === "VIDEO" ? (
            <video
              className={styles.variantThumbMedia}
              src={variant.videoUrl}
              poster={variant.imageUrl}
              muted
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- real, arbitrary hosted GCS/Kie AI creative URL, not a local/optimizable Next asset.
            <img
              className={styles.variantThumbMedia}
              src={variant.imageUrl}
              alt={`Variant ${variant.variantLabel} — ${variant.angle}`}
            />
          )
        ) : (
          <span aria-hidden="true" className={styles.variantThumbIcon}>
            {variant.assetKind === "VIDEO" ? "🎬" : "🖼"}
          </span>
        )}
      </div>
      <span className={styles.variantName}>
        VARIANT {variant.variantLabel} · {variant.angle}
      </span>
      <div className={styles.variantMetricsRow}>
        <span className={styles.metricCtr}>
          {variant.ctr !== undefined ? formatPercent(variant.ctr) : "—"}
        </span>
        <span className={styles.metricSecondary}>{formatIdr(variant.spend)}</span>
        <span className={styles.metricSecondary}>{formatNumber(variant.impressions)}</span>
      </div>
      <p className={styles.variantStatus}>{variantStatusLabel(variant.status)}</p>
    </button>
  );
}

/**
 * AdAdvisor-style detail view — opened by clicking a `VariantCard`. Real media (bigger) + a real
 * metric-card grid (same `MetricCard` primitive `CampaignInsightPanel.tsx` already uses) using
 * exactly the fields this variant's own real Meta-synced insights carry (spend/impressions/clicks/
 * chat/Rp per lead/CTR) — no fabricated "Post engagement"/"Revenue"/ROAS cards AAOS has no real
 * data source for. Real copy text (`primaryText`/`headline`, resolved from the variant's own
 * `creativePackageId`) renders when available; omitted (not "Belum tersedia") when the package has
 * no copy yet, matching this app's own "never fabricate, never force a placeholder for genuinely
 * absent real data" discipline.
 */
function VariantDetailModal({
  variant,
  onClose,
}: {
  readonly variant: AbTestVariantDto;
  readonly onClose: () => void;
}): React.ReactElement {
  const hasRealMedia = variant.imageUrl !== undefined || variant.videoUrl !== undefined;
  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-label={`Variant ${variant.variantLabel} — ${variant.angle}`}
      onClick={onClose}
    >
      <div className={styles.modalPanel} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>
            {variant.headline ?? `Variant ${variant.variantLabel} · ${variant.angle}`}
          </span>
          <button
            type="button"
            className={styles.modalCloseButton}
            aria-label="Tutup"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className={styles.modalMedia}>
          {hasRealMedia ? (
            variant.assetKind === "VIDEO" ? (
              <video
                className={styles.modalMediaContent}
                src={variant.videoUrl}
                poster={variant.imageUrl}
                controls
                playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- real, arbitrary hosted GCS/Kie AI creative URL.
              <img
                className={styles.modalMediaContent}
                src={variant.imageUrl}
                alt={`Variant ${variant.variantLabel} — ${variant.angle}`}
              />
            )
          ) : (
            <span aria-hidden="true" className={styles.modalMediaPlaceholder}>
              {variant.assetKind === "VIDEO" ? "🎬" : "🖼"}
            </span>
          )}
        </div>

        {variant.primaryText !== undefined ? (
          <p className={styles.modalCopyText} data-testid="variant-detail-copy">
            {variant.primaryText}
          </p>
        ) : null}

        <div className={styles.modalMetricsGrid} data-testid="variant-detail-metrics">
          <MetricCard label="Spend" value={formatIdr(variant.spend)} />
          <MetricCard label="Impressions" value={formatNumber(variant.impressions)} />
          <MetricCard
            label="CTR"
            value={variant.ctr !== undefined ? formatPercent(variant.ctr) : "—"}
          />
          <MetricCard label="Chat" value={formatNumber(variant.conversations)} />
          <MetricCard label="Lead" value={formatNumber(variant.leads)} />
          <MetricCard label="Rp/Lead" value={formatRphLead(variant.rphLead)} />
        </div>

        <p className={styles.modalStatus}>{variantStatusLabel(variant.status)}</p>
      </div>
    </div>
  );
}
