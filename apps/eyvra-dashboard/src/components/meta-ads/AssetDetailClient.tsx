"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MetricCard } from "@/components/ui/MetricCard";
import { formatIdr, formatNumber } from "@/lib/formatters";
import type {
  AssetAudienceBreakdownDto,
  AssetCopyVariantDto,
  AssetDetailResponseDto,
  CreativePackageDto,
} from "@/types/dashboard.types";

import styles from "./AssetDetailClient.module.css";

const DEFAULT_DATE_PRESET = "last_30d";

const AUDIENCE_LABEL_TEXT_ID: Readonly<Record<string, string>> = {
  BROAD: "Broad",
  INTEREST: "Interest",
  LOOKALIKE_1: "Lookalike 1%",
  RETARGETING: "Retargeting",
  CUSTOM_CRM: "Custom/CRM",
};

/** The default angle `SamanthaRecommendations.tsx` already uses for a Samantha-originated brief — reused here, same real precedent, not a new convention. */
const DEFAULT_ANGLE = "DP_RINGAN";

export interface AssetDetailClientProps {
  readonly assetId: string;
}

/**
 * `/meta-ads/analytics/assets/:id` page body (AAOS Analytics Platform Phase 4, "Asset detail /
 * Creative Drill-Down"). Auto-fetches `/api/analytics/assets/:id` on mount — same
 * dedicated-endpoint auto-fetch convention `AnalyticsHeatmapClient.tsx` already establishes for
 * this same Analytics Platform effort (contrast `useCampaignsSnapshot`'s manual-fetch-only house
 * style for the SHARED campaigns snapshot; this page has its own dedicated single-asset endpoint).
 */
export function AssetDetailClient({ assetId }: AssetDetailClientProps): React.ReactElement {
  const router = useRouter();
  const [data, setData] = useState<AssetDetailResponseDto | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [notFound, setNotFound] = useState(false);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefError, setBriefError] = useState<string | undefined>(undefined);
  const [briefNotice, setBriefNotice] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setLoading(true);
      setError(undefined);
      setNotFound(false);
      try {
        const params = new URLSearchParams({ datePreset: DEFAULT_DATE_PRESET });
        const res = await fetch(
          `/api/analytics/assets/${encodeURIComponent(assetId)}?${params.toString()}`,
        );
        if (res.status === 404) {
          if (!cancelled) {
            setNotFound(true);
          }
          return;
        }
        if (!res.ok) {
          throw new Error("Gagal memuat detail aset kreatif.");
        }
        const body = (await res.json()) as AssetDetailResponseDto;
        if (!cancelled) {
          setData(body);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat detail aset kreatif.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  /**
   * "Brief ke Kai" — reuses the SAME real `POST /api/creative` endpoint `ManualBriefForm.tsx`/
   * `SamanthaRecommendations.tsx` already POST to (the real, existing creative-brief flow this
   * session's earlier Kai work built — never a second, parallel mechanism). Pre-filled with this
   * asset's own real data: `unit`/`branch` from the representative (highest-spend) copy variant —
   * same honest "ad name is the only unit signal available" precedent
   * `SamanthaRecommendations.tsx` already documents — and `reason` naming the asset's real
   * top-performing audience label. `origin: "SAMANTHA"` (the real enum member for a
   * data-driven/Samantha-triggered brief, not a human-composed one) since this brief exists
   * because of a real performance signal, not free manual authoring.
   */
  async function briefKai(): Promise<void> {
    if (data === undefined) {
      return;
    }
    const representative = data.copyVariants[0];
    if (representative === undefined) {
      setBriefError("Tidak ada iklan nyata pada aset ini untuk dijadikan dasar brief.");
      return;
    }
    setBriefBusy(true);
    setBriefError(undefined);
    setBriefNotice(undefined);
    try {
      const topAudienceText =
        data.topAudienceLabel !== undefined
          ? (AUDIENCE_LABEL_TEXT_ID[data.topAudienceLabel] ?? data.topAudienceLabel)
          : undefined;
      const res = await fetch("/api/creative", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          unit: representative.name,
          branch: representative.branch,
          angle: DEFAULT_ANGLE,
          primaryMessage: `Refresh aset kreatif ${data.assetId}${
            topAudienceText !== undefined ? ` (top audiens: ${topAudienceText})` : ""
          }`,
          format: data.assetKind === "VIDEO" ? "VIDEO_AND_IMAGES" : "IMAGES_ONLY",
          urgency: "MEDIUM",
          origin: "SAMANTHA",
          reason:
            `Dari drill-down aset ${data.assetId} · ${formatNumber(data.adCount)} iklan · ` +
            `${formatIdr(data.spend)} spend` +
            (topAudienceText !== undefined ? ` · audiens terbaik: ${topAudienceText}` : ""),
          generate: false,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal membuat brief dari aset ini.");
      }
      const body = (await res.json()) as { package: CreativePackageDto };
      setBriefNotice(`Brief "${body.package.title}" disimpan sebagai draft untuk Kai.`);
      router.push("/creative");
    } catch (caught) {
      setBriefError(
        caught instanceof Error ? caught.message : "Gagal membuat brief dari aset ini.",
      );
    } finally {
      setBriefBusy(false);
    }
  }

  if (loading) {
    return <LoadingSpinner />;
  }
  if (notFound) {
    return (
      <ErrorCard
        message={`Tidak ditemukan iklan dengan aset kreatif "${assetId}" pada data terkini.`}
      />
    );
  }
  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (data === undefined) {
    return <ErrorCard message="Tidak ada data detail aset yang diterima." />;
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.summaryCard}>
        <p className={styles.assetLabel}>
          {data.assetKind === "IMAGE" ? "🖼️" : "🎬"} {data.assetId}
        </p>
        <div className={styles.kpiStrip}>
          <MetricCard label="Spend" value={formatIdr(data.spend)} />
          <MetricCard label="Lead" value={formatNumber(data.totalLead)} />
          <MetricCard label="CPL" value={data.rphLead !== null ? formatIdr(data.rphLead) : "—"} />
          <MetricCard label="Jumlah Iklan" value={formatNumber(data.adCount)} />
          <MetricCard label="Frequency (max)" value={formatNumber(data.maxFrequency)} />
        </div>
      </section>

      <SamanthaInsight insight={data.insight} />

      <section className={styles.actions}>
        {briefError !== undefined ? <ErrorCard message={briefError} /> : null}
        {briefNotice !== undefined ? <p className={styles.notice}>{briefNotice}</p> : null}
        <button
          type="button"
          className={styles.primaryButton}
          disabled={briefBusy}
          onClick={() => void briefKai()}
        >
          {briefBusy ? "Mengirim…" : "📋 Brief ke Kai"}
        </button>
      </section>

      <AudienceBreakdownTable
        rows={data.audienceBreakdown}
        topAudienceLabel={data.topAudienceLabel}
      />

      <CopyVariantTable rows={data.copyVariants} />
    </div>
  );
}

/**
 * Creative Hub "4 gaps" dispatch, gap 3 — same real Kai/Samantha split
 * `AssetDetailModal.tsx` (the Creative menu's own reuse of this same asset-detail endpoint) now
 * renders; see `AssetInsightLlmPayloadSchema`'s own docstring on `aaos-api` for the real
 * investigation behind the two-persona, one-LLM-call shape. Kept as one `data-testid="asset-insight"`
 * section (not split into two testids) since this page's own existing test only asserts on the
 * combined text content — both real paragraphs are still genuinely rendered.
 */
function SamanthaInsight({
  insight,
}: {
  readonly insight: AssetDetailResponseDto["insight"];
}): React.ReactElement {
  return (
    <section data-testid="asset-insight" className={styles.insightCard}>
      {insight.available ? (
        <>
          <p className={styles.insightLabel}>🎨 Kai — Creative Strategist</p>
          <p className={styles.insightText}>{insight.kaiTake}</p>
          <p className={styles.insightLabel}>📊 Samantha — Verdict</p>
          <p className={styles.insightText}>{insight.samanthaVerdict}</p>
        </>
      ) : (
        <>
          <p className={styles.insightLabel}>🤖 Insight Samantha</p>
          <p className={styles.insightUnavailable}>{insight.message}</p>
        </>
      )}
    </section>
  );
}

function AudienceBreakdownTable({
  rows,
  topAudienceLabel,
}: {
  readonly rows: readonly AssetAudienceBreakdownDto[];
  readonly topAudienceLabel: string | undefined;
}): React.ReactElement {
  return (
    <section className={styles.tableCard}>
      <h3 className={styles.tableTitle}>Performa per Audiens</h3>
      {rows.length === 0 ? (
        <p className={styles.emptyHint}>Belum ada audiens terklasifikasi untuk aset ini.</p>
      ) : (
        <div className={styles.scrollContainer}>
          <table data-testid="audience-breakdown-table" className={styles.table}>
            <thead>
              <tr>
                <th>Audiens</th>
                <th>Iklan</th>
                <th>Spend</th>
                <th>Lead</th>
                <th>CPL</th>
                <th>Frequency (max)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.audienceLabel}
                  data-testid="audience-breakdown-row"
                  className={row.audienceLabel === topAudienceLabel ? styles.rowTop : undefined}
                >
                  <td>
                    {AUDIENCE_LABEL_TEXT_ID[row.audienceLabel] ?? row.audienceLabel}
                    {row.audienceLabel === topAudienceLabel ? (
                      <span className={styles.topBadge}>Terbaik</span>
                    ) : null}
                  </td>
                  <td>{formatNumber(row.adCount)}</td>
                  <td>{formatIdr(row.spend)}</td>
                  <td>{formatNumber(row.totalLead)}</td>
                  <td>{row.cpl !== null ? formatIdr(row.cpl) : "—"}</td>
                  <td>{formatNumber(row.maxFrequency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CopyVariantTable({
  rows,
}: {
  readonly rows: readonly AssetCopyVariantDto[];
}): React.ReactElement {
  return (
    <section className={styles.tableCard}>
      <h3 className={styles.tableTitle}>Variasi Copy (per Iklan)</h3>
      <p className={styles.tableSubtitle}>
        Nama iklan dipakai sebagai label variasi copy — data teks headline/body kreatif belum
        ditarik dari Meta untuk aset ini.
      </p>
      {rows.length === 0 ? (
        <p className={styles.emptyHint}>Tidak ada iklan nyata untuk aset ini.</p>
      ) : (
        <div className={styles.scrollContainer}>
          <table data-testid="copy-variant-table" className={styles.table}>
            <thead>
              <tr>
                <th>Nama Iklan</th>
                <th>Cabang</th>
                <th>Audiens</th>
                <th>Spend</th>
                <th>Lead</th>
                <th>CPL</th>
                <th>Frequency</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.adId} data-testid="copy-variant-row">
                  <td>
                    #{row.stableId} · {row.name}
                  </td>
                  <td>{row.branch}</td>
                  <td>
                    {row.audienceLabel !== undefined
                      ? (AUDIENCE_LABEL_TEXT_ID[row.audienceLabel] ?? row.audienceLabel)
                      : "—"}
                  </td>
                  <td>{formatIdr(row.spend)}</td>
                  <td>{formatNumber(row.totalLead)}</td>
                  <td>{row.cpl !== null ? formatIdr(row.cpl) : "—"}</td>
                  <td>{formatNumber(row.frequency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
