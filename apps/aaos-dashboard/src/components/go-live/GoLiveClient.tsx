"use client";

import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { AdAccountSummaryDto, SimulationStatusDto } from "@/types/dashboard.types";

import styles from "./GoLiveClient.module.css";

const POLL_INTERVAL_MS = 5000;

/** One live campaign's real Meta data, when `GET /api/campaigns` (real `getCampaigns`/`getAds` reads) happened to include it — `undefined` fields are an honest "not yet synced", never a fabricated 0. */
interface LiveCampaignMetaData {
  readonly status: string;
  readonly spend: number;
  readonly totalLead: number;
}

function matchCampaign(
  campaignId: string | undefined,
  campaignsData: AdAccountSummaryDto | undefined,
): LiveCampaignMetaData | undefined {
  if (campaignId === undefined || campaignsData === undefined) {
    return undefined;
  }
  const campaign = campaignsData.campaigns.find((c) => c.id === campaignId);
  if (campaign === undefined) {
    return undefined;
  }
  const totalLead = campaign.adSets
    .flatMap((adSet) => adSet.ads)
    .reduce((sum, ad) => sum + ad.metrics.totalLead, 0);
  return { status: campaign.status, spend: campaign.spend, totalLead };
}

/**
 * `/go-live` — Go Live Monitor (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 4). Was a deliberate,
 * honest always-empty placeholder (see git history/coordinator note section 8's closing
 * paragraph) because `SimulationStatus` had no real `"LIVE"` state to query for. Phase 4 added
 * that real state — this page now polls `GET /api/simulation/live` (proxying `aaos-api`'s real
 * `GET /api/v1/simulation/live`, itself reading `simulations` rows with `status='LIVE'`) instead
 * of staying permanently empty.
 *
 * Per-campaign real Meta data (status/spend/total leads) comes from `GET /api/campaigns`
 * (`aaos-api`'s real `pullCampaigns`, itself `getCampaigns`/`getAdSets`/`getAds`) matched by the
 * simulation's real `liveCampaignId` — no Realtime subscription, polling only (this session's
 * established Log Panel precedent). A live campaign not yet found in that pull (e.g. Meta's
 * insights lag) shows an honest "belum tersinkron" note rather than a fabricated 0/PAUSED.
 */
export function GoLiveClient(): React.ReactElement {
  const [live, setLive] = useState<readonly SimulationStatusDto[] | undefined>(undefined);
  const [campaignsData, setCampaignsData] = useState<AdAccountSummaryDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [pauseError, setPauseError] = useState<string | undefined>(undefined);
  const [pendingId, setPendingId] = useState<string | undefined>(undefined);
  const [detailId, setDetailId] = useState<string | undefined>(undefined);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/simulation/live");
      if (!res.ok) {
        throw new Error("Gagal memuat campaign live.");
      }
      const body = (await res.json()) as { live: readonly SimulationStatusDto[] };
      setLive(body.live);
      setError(undefined);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Gagal memuat campaign live.");
    }
    try {
      const res = await fetch("/api/campaigns");
      if (res.ok) {
        setCampaignsData((await res.json()) as AdAccountSummaryDto);
      }
    } catch {
      // Campaign meta-data is a real-time-ish nicety, not the page's core data — a failed fetch
      // here degrades to "belum tersinkron" per-card, never blocks the LIVE list itself.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  async function pauseCampaign(id: string): Promise<void> {
    setPendingId(id);
    setPauseError(undefined);
    try {
      const res = await fetch(`/api/simulation/${id}/pause`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json()) as { error?: { message?: string } };
        setPauseError(body.error?.message ?? "Pause gagal.");
        return;
      }
      await refresh();
    } catch {
      setPauseError("Pause gagal.");
    } finally {
      setPendingId(undefined);
    }
  }

  async function rollback(id: string): Promise<void> {
    setPendingId(id);
    setPauseError(undefined);
    try {
      const res = await fetch(`/api/simulation/${id}/rollback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: { message?: string } };
        setPauseError(body.error?.message ?? "Rollback gagal.");
        return;
      }
      await refresh();
    } catch {
      setPauseError("Rollback gagal.");
    } finally {
      setPendingId(undefined);
    }
  }

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (live === undefined) {
    return <LoadingSpinner />;
  }

  const matches = live.map((entry) => matchCampaign(entry.liveCampaignId, campaignsData));
  const pausedCount = matches.filter((m) => m?.status === "PAUSED").length;
  const totalSpend = matches.reduce((sum, m) => sum + (m?.spend ?? 0), 0);
  const totalLead = matches.reduce((sum, m) => sum + (m?.totalLead ?? 0), 0);

  return (
    <div className={styles.page}>
      <div className={styles.kpiStrip} data-testid="go-live-kpi-strip">
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>LIVE</p>
          <p className={styles.kpiValue}>{live.length}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>PAUSED</p>
          <p className={styles.kpiValue}>{pausedCount}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>TOTAL SPEND</p>
          <p className={styles.kpiValue}>Rp {totalSpend.toLocaleString("id-ID")}</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>TOTAL LEAD</p>
          <p className={styles.kpiValue}>{totalLead}</p>
        </div>
      </div>

      {pauseError !== undefined ? <ErrorCard message={pauseError} /> : null}

      {live.length === 0 ? (
        <EmptyState
          icon="🚀"
          title="Belum ada campaign live"
          description="Mulai dari menu Simulasi."
        />
      ) : (
        <div className={styles.cardGrid} data-testid="go-live-card-grid">
          {live.map((entry, index) => {
            const meta = matches[index];
            return (
              <div
                key={entry.id}
                className={styles.kpiCell}
                data-testid={`go-live-card-${entry.id}`}
              >
                <p className={styles.kpiLabel}>{entry.status}</p>
                <p className={styles.rowText}>
                  Campaign: <code>{entry.liveCampaignId}</code>
                  <br />
                  Ad: <code>{entry.liveAdId}</code>
                  {entry.liveAt !== undefined ? (
                    <>
                      <br />
                      Sejak {new Date(entry.liveAt).toLocaleString("id-ID")}
                    </>
                  ) : null}
                </p>
                <p className={styles.rowText}>
                  {meta !== undefined
                    ? `Status Meta: ${meta.status} · Spend Rp ${meta.spend.toLocaleString("id-ID")} · Lead ${meta.totalLead}`
                    : "Data campaign belum tersinkron dari Meta."}
                </p>
                <div className={styles.cardActions}>
                  {entry.status === "LIVE" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void pauseCampaign(entry.id)}
                        disabled={pendingId === entry.id}
                        className={styles.actionButton}
                      >
                        ⏸ Pause
                      </button>
                      <button
                        type="button"
                        onClick={() => void rollback(entry.id)}
                        disabled={pendingId === entry.id}
                        className={styles.actionButton}
                      >
                        ↩ Rollback
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      setDetailId((current) => (current === entry.id ? undefined : entry.id))
                    }
                    className={styles.actionButton}
                  >
                    📊 Detail
                  </button>
                </div>
                {detailId === entry.id ? (
                  <div className={styles.detailLog} data-testid={`go-live-detail-${entry.id}`}>
                    {entry.logs
                      .filter((log) => log.step === "GO_LIVE")
                      .map((log, logIndex) => (
                        <p key={`${log.createdAt}-${logIndex}`} className={styles.rowText}>
                          [{new Date(log.createdAt).toLocaleTimeString("id-ID")}] {log.message}
                        </p>
                      ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
