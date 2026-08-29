"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

                <div className={styles.variantGrid}>
                  {test.variants.map((variant) => (
                    <div key={variant.id} className={styles.variantCol}>
                      <p className={styles.variantLabel}>
                        VARIANT {variant.variantLabel} · {variant.angle}
                      </p>
                      <div className={styles.variantMetrics}>
                        <p>Belanja: {formatIdr(variant.spend)}</p>
                        <p>Impresi: {formatNumber(variant.impressions)}</p>
                        <p>Chat: {variant.conversations}</p>
                        <p>Rp/lead: {formatRphLead(variant.rphLead)}</p>
                        <p>CTR: {variant.ctr !== undefined ? formatPercent(variant.ctr) : "—"}</p>
                      </div>
                      <p className={styles.variantStatus}>{variantStatusLabel(variant.status)}</p>
                    </div>
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
    </div>
  );
}
