"use client";

import { useEffect, useState } from "react";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { CampaignHealthResponseDto } from "@/types/campaign-health.types";

import styles from "./AutomationPanel.module.css";

export interface AutomationPanelProps {
  readonly campaignId: string;
  readonly campaignName: string;
}

/**
 * `AutomationPanel` (EYVRA Samantha V2 + Kai V2 Phase 51 — PROMPT 79) — the mockup's Campaign
 * Detail "side Automation panel" (mode / next review / success+rollback conditions).
 *
 * REAL DATA vs HONEST OMIT, investigated for this dispatch:
 *  - "Mode" (Advisor/Copilot/Guarded Autopilot/Autonomous, mockup panel 7 "Automation" page) — this
 *    session's earlier backend audits repeatedly confirmed NO real autopilot/guardrail-mode system
 *    exists anywhere in this codebase (every action this app takes — `POST /api/verdicts`, "Brief
 *    Kai Sekarang" — is always a human-clicked button, never a backend-enforced mode). This panel
 *    honestly labels that cell "belum tersedia" rather than fabricating a mode selector with no real
 *    backend effect.
 *  - "Next review" / "success conditions" / "rollback conditions" — REAL, already computed server-
 *    side: `SamanthaDecisionDto.monitoringPlan` (`reviewAfterHours`/`successConditions`/
 *    `rollbackConditions`), part of the same real `GET /api/campaign-health/:campaignId` response
 *    `CampaignHealthCard.tsx` already renders (Phase 4's deterministic decision engine) — simply
 *    never surfaced visually until now.
 *
 * Deliberately its OWN independent best-effort fetch of the SAME real endpoint
 * `CampaignHealthCard` already calls, rather than a prop threaded down from that card — the two
 * components are rendered side-by-side in different areas of `CampaignDetailTabs` (main column vs
 * side panel), and lifting `CampaignHealthCard`'s internal fetch state up would mean touching that
 * card's own tested internals. Same "independent best-effort fetch, honest absence on failure"
 * precedent `CampaignHealthCard.tsx`'s own `TrendSection`/`AndromedaHealthCard`/`OpportunitiesCard`
 * already establish for exactly this reason (see those components' own docs) — never re-derives the
 * decision/monitoring-plan logic itself, only reads the field the backend already computed.
 */
export function AutomationPanel({
  campaignId,
  campaignName,
}: AutomationPanelProps): React.ReactElement {
  const [data, setData] = useState<CampaignHealthResponseDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    setError(undefined);
    fetch(`/api/campaign-health/${encodeURIComponent(campaignId)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat Automation panel.");
        }
        const body = (await res.json()) as Partial<CampaignHealthResponseDto>;
        if (body.decision === undefined) {
          throw new Error("Respons monitoring plan tidak lengkap.");
        }
        return body as CampaignHealthResponseDto;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat Automation panel.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  if (error !== undefined) {
    return (
      <aside data-testid="automation-panel" className={styles.panel}>
        <h3 className={styles.title}>Automation — {campaignName}</h3>
        <p className={styles.errorBox}>{error}</p>
      </aside>
    );
  }

  if (data === undefined) {
    return (
      <aside data-testid="automation-panel" className={styles.panel}>
        <h3 className={styles.title}>Automation — {campaignName}</h3>
        <LoadingSpinner />
      </aside>
    );
  }

  const { monitoringPlan } = data.decision;

  return (
    <aside data-testid="automation-panel" className={styles.panel}>
      <h3 className={styles.title}>Automation — {campaignName}</h3>

      <div className={styles.row}>
        <span className={styles.label}>Mode</span>
        <p data-testid="automation-mode" className={styles.unavailable}>
          Belum tersedia — sistem guardrail/mode otomasi (Advisor/Copilot/Autopilot) belum ada di
          backend ini. Setiap tindakan (Terapkan Verdict, Brief Kai) saat ini selalu diklik manual.
        </p>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Tinjau Ulang Berikutnya</span>
        <p data-testid="automation-next-review" className={styles.value}>
          ~{monitoringPlan.reviewAfterHours} jam dari assessment terakhir
        </p>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Kondisi Sukses</span>
        {monitoringPlan.successConditions.length > 0 ? (
          <ul data-testid="automation-success-conditions" className={styles.list}>
            {monitoringPlan.successConditions.map((condition, index) => (
              <li key={`success-${String(index)}`}>{condition}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.unavailable}>Tidak ada kondisi sukses spesifik.</p>
        )}
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Kondisi Rollback</span>
        {monitoringPlan.rollbackConditions.length > 0 ? (
          <ul data-testid="automation-rollback-conditions" className={styles.list}>
            {monitoringPlan.rollbackConditions.map((condition, index) => (
              <li key={`rollback-${String(index)}`}>{condition}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.unavailable}>Tidak ada kondisi rollback spesifik.</p>
        )}
      </div>
    </aside>
  );
}

export default AutomationPanel;
