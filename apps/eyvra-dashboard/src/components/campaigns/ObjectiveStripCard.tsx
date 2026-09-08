"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatNumber } from "@/lib/formatters";
import type { ObjectiveDto, OverviewLeadsSummaryDto } from "@/types/dashboard.types";
import type { PropertyObjectiveDto } from "@/types/property-objective.types";
import type { Vertical } from "@/types/tenant.types";

import styles from "./ObjectiveStripCard.module.css";

export interface ObjectiveStripCardProps {
  /** Reports the real, filled-in `targetCpl` business-context number (PROPERTY only) up to the parent page, so it can be used as `UnifiedCampaignTable`/`CampaignInsightPanel`'s CPL benchmark ahead of the real account-wide fallback. `undefined` while still loading, `null` once loaded with no real value to report. */
  readonly onTargetCplResolved?: (targetCplIDR: number | null) => void;
}

/**
 * AAOS-CAMPAIGNS-UNIFIED-PAGE — bottom-strip "Objective" card (spec: "real HOT-lead target/
 * progress").
 *
 * Reuses the SAME real vertical resolution + `/api/objective`/`/api/property-objective` load
 * `ObjectiveClient.tsx` already establishes (`GET /api/settings` → `tenant.vertical`) — no second
 * "who am I" mechanism, and Sprint 6's real business-context fields on `property_objectives`
 * (`avgDealValue`/`targetCpl`/`breakevenCpl`) are reused here, never re-forked into a second table.
 *
 * "Progress" honesty: no month-scoped "HOT leads created this calendar month" counter exists
 * anywhere in this codebase — the closest real number is `OverviewResponseDto.leads.hot`
 * (`GET /api/overview`), the CURRENT total real count of leads with `temperature === HOT` (not
 * strictly scoped to the objective's own period). This card uses that real number with an explicit
 * caveat label rather than fabricating a month-scoped count, same "closest real available proxy,
 * openly labeled" judgment call `MetricsTab.tsx`'s "Cost per Result" doc makes for its own domain.
 */
export function ObjectiveStripCard({
  onTargetCplResolved,
}: ObjectiveStripCardProps): React.ReactElement {
  const [vertical, setVertical] = useState<Vertical>("AUTOMOTIVE");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [objective, setObjective] = useState<
    ObjectiveDto | PropertyObjectiveDto | null | undefined
  >(undefined);
  const [leads, setLeads] = useState<OverviewLeadsSummaryDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) =>
        res.ok ? (res.json() as Promise<{ tenant?: { vertical?: Vertical } }>) : null,
      )
      .then((data) => {
        if (cancelled) return;
        if (data?.tenant?.vertical !== undefined) {
          setVertical(data.tenant.vertical);
        }
        setSettingsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setSettingsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    let cancelled = false;
    const path = vertical === "PROPERTY" ? "/api/property-objective" : "/api/objective";
    fetch(path)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat objective.");
        }
        return (await res.json()) as { objective: ObjectiveDto | PropertyObjectiveDto | null };
      })
      .then((body) => {
        if (cancelled) return;
        setObjective(body.objective);
        const targetCpl =
          vertical === "PROPERTY" && body.objective !== null
            ? ((body.objective as PropertyObjectiveDto).targetCpl ?? null)
            : null;
        onTargetCplResolved?.(targetCpl);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat objective.");
          onTargetCplResolved?.(null);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per vertical resolution, same pattern ObjectiveClient.tsx's own effect uses.
  }, [settingsLoaded, vertical]);

  useEffect(() => {
    fetch("/api/overview")
      .then((res) => (res.ok ? (res.json() as Promise<{ leads?: OverviewLeadsSummaryDto }>) : null))
      .then((body) => {
        if (body?.leads !== undefined) {
          setLeads(body.leads);
        }
      })
      .catch(() => {
        // Best-effort only — the target itself still renders without real "current" progress.
      });
  }, []);

  if (!settingsLoaded || objective === undefined) {
    return (
      <section className={styles.section}>
        <h3 className={styles.title}>Objective</h3>
        <LoadingSpinner />
      </section>
    );
  }

  if (error !== undefined || objective === null) {
    return (
      <section className={styles.section}>
        <h3 className={styles.title}>Objective</h3>
        <EmptyState
          title="Belum ada objective"
          description="Isi target HOT leads bulan ini di halaman Settings."
        />
      </section>
    );
  }

  const target = objective.targetHotLeads;
  const achieved = leads?.hot;
  const percent =
    achieved !== undefined && target > 0
      ? Math.min(100, Math.round((achieved / target) * 100))
      : undefined;

  return (
    <section data-testid="objective-strip-card" className={styles.section}>
      <h3 className={styles.title}>Objective</h3>
      <p className={styles.target}>Target {formatNumber(target)} HOT leads bulan ini</p>
      {percent !== undefined && achieved !== undefined ? (
        <>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
          </div>
          <p className={styles.progressLabel}>
            {formatNumber(achieved)} / {formatNumber(target)} ({percent}%) — HOT leads real saat ini
            (bukan hanya bulan ini)
          </p>
        </>
      ) : (
        <p className={styles.progressLabel}>Progress real belum tersedia.</p>
      )}
    </section>
  );
}

export default ObjectiveStripCard;
