"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatNumber } from "@/lib/formatters";
import { daysElapsedInMonth, daysInMonth } from "@/lib/monthProgress";
import type { LeadDto, ObjectiveDto, OverviewLeadsSummaryDto } from "@/types/dashboard.types";
import type { PropertyObjectiveDto } from "@/types/property-objective.types";
import type { Vertical } from "@/types/tenant.types";

import styles from "./ObjectiveStripCard.module.css";

export interface ObjectiveStripCardProps {
  /** Reports the real, filled-in `targetCpl` business-context number (PROPERTY only) up to the parent page, so it can be used as `UnifiedCampaignTable`/`CampaignInsightPanel`'s CPL benchmark ahead of the real account-wide fallback. `undefined` while still loading, `null` once loaded with no real value to report. */
  readonly onTargetCplResolved?: (targetCplIDR: number | null) => void;
  /**
   * Campaign Page Rebuild v2 (Prompt 4) — the SAME already-loaded campaign list
   * `CampaignsHubClient` passes to `UnifiedCampaignTable`/`BudgetTracker`, reused only for real
   * campaign-name lookup in the new per-campaign HOT-lead breakdown below (never a second
   * campaign-loading mechanism). `undefined`/omitted degrades to showing raw campaign ids.
   */
  readonly campaigns?: readonly { readonly id: string; readonly name: string }[];
  /** Injectable for tests only — defaults to `new Date()`. */
  readonly now?: Date;
}

const HOT_LEAD_BREAKDOWN_LIMIT = 5;
const NO_CAMPAIGN_KEY = "__no_campaign__";

interface CampaignHotLeadRow {
  readonly key: string;
  readonly name: string;
  readonly count: number;
}

/**
 * Real per-campaign HOT-lead breakdown (Campaign Page Rebuild v2, Prompt 4) — groups the same
 * real `/api/leads` rows `/clara/contacts` already lists by their real `LeadDto.campaignId`
 * (Meta/Clara's own real attribution, just newly modeled on this list-level type — see that
 * field's own doc). Leads with no real `campaignId` (not every lead is Meta-attributed — some
 * come from organic/manual sources) are bucketed under one honest "Tanpa campaign" row rather
 * than silently dropped or guessed at.
 */
function buildHotLeadBreakdown(
  leads: readonly LeadDto[],
  campaigns: readonly { readonly id: string; readonly name: string }[],
): readonly CampaignHotLeadRow[] {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    if (lead.temperature !== "HOT") continue;
    const key = lead.campaignId ?? NO_CAMPAIGN_KEY;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rows = Array.from(counts.entries()).map(([key, count]) => ({
    key,
    name:
      key === NO_CAMPAIGN_KEY
        ? "Tanpa campaign"
        : (campaigns.find((campaign) => campaign.id === key)?.name ?? key),
    count,
  }));
  rows.sort((a, b) => b.count - a.count);
  return rows.slice(0, HOT_LEAD_BREAKDOWN_LIMIT);
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
 *
 * Campaign Page Rebuild v2 (Prompt 4) additions:
 * - Real per-campaign HOT-lead breakdown (`buildHotLeadBreakdown`, from the same real
 *   `/api/leads` rows `/clara/contacts` lists — real `LeadDto.campaignId`, not fabricated).
 * - A real, explicitly-labeled "projected end of month" estimate: `achieved / elapsedDays *
 *   totalDays`, the SAME real elapsed/total-day pace basis `BudgetTracker.tsx`'s own estimate
 *   uses (`@/lib/monthProgress`) — labeled "estimasi" for the same reason: `achieved` is the
 *   CURRENT total (not month-scoped), so the projection inherits that same caveat, never
 *   presented as a real month-to-date trend.
 * - Deliberately NOT built: "trend vs previous period" — there is no real month-scoped historical
 *   snapshot of HOT-lead counts anywhere in this codebase (this card's own `achieved` number is
 *   always "right now," never a stored past value), so a real previous-period comparison has
 *   nothing real to read from; fabricating one would violate this card's own "closest real
 *   available proxy, openly labeled" discipline above.
 */
export function ObjectiveStripCard({
  onTargetCplResolved,
  campaigns,
  now,
}: ObjectiveStripCardProps): React.ReactElement {
  const [vertical, setVertical] = useState<Vertical>("AUTOMOTIVE");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [objective, setObjective] = useState<
    ObjectiveDto | PropertyObjectiveDto | null | undefined
  >(undefined);
  const [leads, setLeads] = useState<OverviewLeadsSummaryDto | undefined>(undefined);
  const [hotLeadRows, setHotLeadRows] = useState<readonly LeadDto[] | undefined>(undefined);
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

  useEffect(() => {
    fetch("/api/leads")
      .then((res) => (res.ok ? (res.json() as Promise<{ leads?: readonly LeadDto[] }>) : null))
      .then((body) => {
        if (body?.leads !== undefined) {
          setHotLeadRows(body.leads);
        }
      })
      .catch(() => {
        // Best-effort only — the breakdown section simply doesn't render without it.
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

  const today = now ?? new Date();
  const elapsedDays = daysElapsedInMonth(today);
  const totalDays = daysInMonth(today);
  const projected =
    achieved !== undefined && elapsedDays > 0
      ? Math.round((achieved / elapsedDays) * totalDays)
      : undefined;
  const projectedPercent =
    projected !== undefined && target > 0 ? Math.round((projected / target) * 100) : undefined;

  const breakdown =
    hotLeadRows !== undefined ? buildHotLeadBreakdown(hotLeadRows, campaigns ?? []) : undefined;

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
          {projected !== undefined ? (
            <p data-testid="objective-projection" className={styles.projectionLabel}>
              Proyeksi akhir bulan (estimasi, hari ke-{elapsedDays}/{totalDays}): ~
              {formatNumber(projected)} HOT leads
              {projectedPercent !== undefined ? ` (${projectedPercent}% dari target)` : ""}
            </p>
          ) : null}
        </>
      ) : (
        <p className={styles.progressLabel}>Progress real belum tersedia.</p>
      )}
      {breakdown !== undefined && breakdown.length > 0 ? (
        <div className={styles.breakdownBlock}>
          <p className={styles.breakdownTitle}>HOT leads per campaign</p>
          <ul data-testid="objective-hot-lead-breakdown" className={styles.breakdownList}>
            {breakdown.map((row) => (
              <li key={row.key} className={styles.breakdownRow}>
                <span className={styles.breakdownName}>{row.name}</span>
                <span className={styles.breakdownCount}>{formatNumber(row.count)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default ObjectiveStripCard;
