"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { stripAdNameSuffix } from "@/lib/adName";
import { formatNumber } from "@/lib/formatters";
import { useCampaignsSnapshot } from "@/lib/useCampaignsSnapshot";
import type { CampaignAdDto, CreativeFormatDto, CreativePackageDto } from "@/types/dashboard.types";

import styles from "./TamaraRecommendations.module.css";

/**
 * The angle Tamara's own `AngleRecommender` treats as the default first-rank angle, reused here as
 * the pre-filled suggestion. The manager can change it before approving — nothing is sent to Kai
 * until they do.
 */
const DEFAULT_ANGLE = "DP_RINGAN";
const AD_ANGLES = [
  "DP_RINGAN",
  "KREDIT_SYARIAH",
  "GUDANGNYA",
  "QNA",
  "DISCOVERY",
  "TESTIMONIAL",
  "WEBSITE_REDIRECT",
] as const;

export interface TamaraRecommendationsProps {
  readonly onCreated: (created: CreativePackageDto) => Promise<void> | void;
}

/**
 * "Rekomendasi Tamara" — ads that already carry a REFRESH verdict.
 *
 * Reuses the real, already-computed `ad.verdict === "REFRESH"` field straight off the campaigns
 * snapshot (`VerdictEngine`'s output, precedence FIX > PAUSE > SCALE > REFRESH > KEEP > REVIEW).
 * It deliberately does NOT recompute any frequency/days-running/CTR-drop threshold client-side —
 * "which ads need a creative refresh" is exactly what the REFRESH verdict already means, and
 * re-deriving that classification here would be a second, divergent source of truth.
 *
 * The frequency shown alongside each card is the real `ad.metrics.frequency` from the same
 * snapshot, used only as CONTEXT for why Tamara flagged it — never as the flag itself.
 *
 * Approving a recommendation only creates a `DRAFT`/`GENERATING` package through the same endpoint
 * the manual form uses. There is no auto-approval path.
 */
export function TamaraRecommendations({
  onCreated,
}: TamaraRecommendationsProps): React.ReactElement {
  const { data, loading, error, pull } = useCampaignsSnapshot();
  const [busyAdId, setBusyAdId] = useState<string | undefined>(undefined);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const [angleByAd, setAngleByAd] = useState<Readonly<Record<string, string>>>({});
  const [formatByAd, setFormatByAd] = useState<Readonly<Record<string, CreativeFormatDto>>>({});

  const needsRefresh = useMemo(
    () => (data?.ads ?? []).filter((ad) => ad.verdict === "REFRESH"),
    [data],
  );

  async function approve(ad: CampaignAdDto, generate: boolean): Promise<void> {
    setBusyAdId(ad.id);
    setSubmitError(undefined);
    try {
      const res = await fetch("/api/creative", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // The ad name is the only unit signal Tamara's snapshot carries; it is NOT a scraped
          // unit `identityKey`, so Kai may find no source photos for it and generate without a
          // reference image. That is surfaced honestly on the resulting package.
          unit: stripAdNameSuffix(ad.name),
          branch: ad.branch,
          angle: angleByAd[ad.id] ?? DEFAULT_ANGLE,
          primaryMessage: `Refresh creative ${stripAdNameSuffix(ad.name)}`,
          format: formatByAd[ad.id] ?? "VIDEO_AND_IMAGES",
          urgency: "HIGH",
          origin: "TAMARA",
          adId: ad.id,
          stableId: ad.stableId,
          reason: `Verdict Tamara REFRESH · frequency ${formatNumber(ad.metrics.frequency)}${
            ad.daysSinceCreation !== undefined
              ? ` · ${String(ad.daysSinceCreation)} hari berjalan`
              : ""
          }`,
          generate,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal membuat brief dari rekomendasi.");
      }
      const body = (await res.json()) as { package: CreativePackageDto };
      await onCreated(body.package);
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "Gagal membuat brief.");
    } finally {
      setBusyAdId(undefined);
    }
  }

  return (
    <div className={styles.wrapper}>
      <section className={styles.banner}>
        <div>
          <p className={styles.bannerTitle}>
            🤖 {needsRefresh.length} iklan bervonis REFRESH dari Tamara
          </p>
          <p className={styles.bannerMeta}>
            Diambil langsung dari verdict `VerdictEngine` pada snapshot iklan — bukan hitungan ulang
            di halaman ini.
          </p>
        </div>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={loading}
          onClick={() => void pull()}
        >
          {loading ? "Menarik data…" : "🔄 Tarik data iklan"}
        </button>
      </section>

      {error !== undefined ? <ErrorCard message={error} /> : null}
      {submitError !== undefined ? <ErrorCard message={submitError} /> : null}

      {data === undefined ? (
        <EmptyState
          title="Belum ada data iklan"
          description="Tekan “Tarik data iklan” untuk memuat snapshot terbaru dari Meta."
        />
      ) : needsRefresh.length === 0 ? (
        <EmptyState
          title="Tidak ada iklan bervonis REFRESH"
          description="Tamara belum menandai satu pun iklan butuh creative baru pada snapshot ini."
        />
      ) : (
        needsRefresh.map((ad) => (
          <section key={ad.id} data-testid="tamara-recommendation" className={styles.card}>
            <div className={styles.cardHeader}>
              <p className={styles.cardTitle}>
                #{ad.stableId} · {stripAdNameSuffix(ad.name)}
              </p>
              <span className={styles.freq}>freq: {formatNumber(ad.metrics.frequency)}</span>
            </div>
            <p className={styles.cardMeta}>
              {ad.branch} ·{" "}
              {ad.daysSinceCreation !== undefined
                ? `${String(ad.daysSinceCreation)} hari berjalan`
                : "umur iklan tidak tersedia"}{" "}
              · {formatNumber(ad.metrics.conversations)} percakapan
            </p>

            <div className={styles.controls}>
              <label className={styles.control}>
                <span className={styles.controlLabel}>Angle</span>
                <select
                  className={styles.select}
                  value={angleByAd[ad.id] ?? DEFAULT_ANGLE}
                  onChange={(event) =>
                    setAngleByAd((current) => ({ ...current, [ad.id]: event.target.value }))
                  }
                >
                  {AD_ANGLES.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.control}>
                <span className={styles.controlLabel}>Format</span>
                <select
                  className={styles.select}
                  value={formatByAd[ad.id] ?? "VIDEO_AND_IMAGES"}
                  onChange={(event) =>
                    setFormatByAd((current) => ({
                      ...current,
                      [ad.id]: event.target.value as CreativeFormatDto,
                    }))
                  }
                >
                  <option value="VIDEO_AND_IMAGES">Video + Gambar</option>
                  <option value="IMAGES_ONLY">Gambar saja</option>
                </select>
              </label>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={busyAdId === ad.id}
                onClick={() => void approve(ad, true)}
              >
                ✓ Setujui brief ini → Kirim ke Kai
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={busyAdId === ad.id}
                onClick={() => void approve(ad, false)}
              >
                ✏ Simpan sebagai draft dulu
              </button>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
