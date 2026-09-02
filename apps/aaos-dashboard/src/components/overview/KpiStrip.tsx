import { formatIdrCompact, formatNumber } from "@/lib/formatters";
import type {
  OverviewAgentScoreDto,
  OverviewCampaignsSummaryDto,
  OverviewLeadsSummaryDto,
  OverviewRecyclingSummaryDto,
} from "@/types/dashboard.types";

import styles from "./KpiStrip.module.css";

/**
 * 6-metric KPI strip (spec `docs/PROMPT-EYVRA-OVERVIEW-MONITOR-PAGE.md` "BAGIAN 3") — REAL FINDING
 * correcting that pasted spec's assumed `KpiData` shape: it assumes `avgCplToday`/`spendToday`/
 * `waLeadsTotal`(with HOT/WARM/COLD breakdown)/`aiScoreAvg` fields that O1's real
 * `OverviewResponseDto` doesn't carry directly. Every cell below is instead built honestly from
 * exactly what O1 DOES return (`leads`/`campaigns`/`agentStatus`/`recycling`, each independently
 * `undefined`-degradable) — no invented field, no fabricated placeholder number.
 *
 * `campaigns.totalSpend`/`campaigns.datePreset` in particular is deliberately labeled by its real
 * window ("7 hari terakhir", not "hari ini") — `OverviewCampaignsSummaryDto.datePreset`'s own doc
 * explains Meta's real pull has no per-day preset at all, so a literal "spend hari ini" label would
 * be dishonest.
 */
export interface KpiStripData {
  readonly leads?: OverviewLeadsSummaryDto;
  readonly campaigns?: OverviewCampaignsSummaryDto;
  readonly agentStatus: readonly OverviewAgentScoreDto[];
  readonly recycling?: OverviewRecyclingSummaryDto;
}

function deltaClass(delta: number): string {
  if (delta > 0) {
    return styles.deltaUp ?? "";
  }
  if (delta < 0) {
    return styles.deltaDown ?? "";
  }
  return styles.deltaNeutral ?? "";
}

function datePresetLabel(datePreset: string): string {
  if (datePreset === "last_7d") {
    return "7 hari terakhir";
  }
  if (datePreset === "last_14d") {
    return "14 hari terakhir";
  }
  if (datePreset === "last_30d") {
    return "30 hari terakhir";
  }
  return datePreset;
}

function Unavailable(): React.ReactElement {
  return <p className={styles.unavailable}>Data tidak tersedia</p>;
}

export function KpiStrip({
  leads,
  campaigns,
  agentStatus,
  recycling,
}: KpiStripData): React.ReactElement {
  const scoredAgents = agentStatus.filter(
    (entry): entry is OverviewAgentScoreDto & { todayAverageOverall: number } =>
      entry.todayAverageOverall !== undefined,
  );
  const avgScore =
    scoredAgents.length > 0
      ? scoredAgents.reduce((sum, entry) => sum + entry.todayAverageOverall, 0) /
        scoredAgents.length
      : undefined;
  const deltaAgents = agentStatus.filter(
    (entry): entry is OverviewAgentScoreDto & { delta: number } => entry.delta !== undefined,
  );
  const avgScoreDelta =
    deltaAgents.length > 0
      ? deltaAgents.reduce((sum, entry) => sum + entry.delta, 0) / deltaAgents.length
      : undefined;

  return (
    <div className={styles.strip} data-testid="kpi-strip">
      <div className={styles.cell}>
        <p className={styles.label}>HOT leads hari ini</p>
        {leads === undefined ? (
          <Unavailable />
        ) : (
          <>
            <p className={styles.value}>{formatNumber(leads.hotToday)}</p>
            <p className={`${styles.delta} ${deltaClass(leads.hotDeltaVsYesterday)}`}>
              {leads.hotDeltaVsYesterday >= 0 ? "+" : ""}
              {formatNumber(leads.hotDeltaVsYesterday)} dari kemarin
            </p>
          </>
        )}
      </div>

      <div className={styles.cell}>
        <p className={styles.label}>Leads HOT/WARM/COLD</p>
        {leads === undefined ? (
          <Unavailable />
        ) : (
          <>
            <p className={styles.value}>{formatNumber(leads.hot + leads.warm + leads.cold)}</p>
            <p className={`${styles.delta} ${styles.deltaNeutral}`}>
              {leads.hot} HOT · {leads.warm} WARM · {leads.cold} COLD
            </p>
          </>
        )}
      </div>

      <div className={styles.cell}>
        <p className={styles.label}>Campaign aktif</p>
        {campaigns === undefined ? (
          <Unavailable />
        ) : (
          <>
            <p className={styles.value}>{formatNumber(campaigns.activeCampaignsCount)}</p>
            <p className={`${styles.delta} ${styles.deltaNeutral}`}>
              dari {formatNumber(campaigns.totalCampaignsCount)} total
            </p>
          </>
        )}
      </div>

      <div className={styles.cell}>
        <p className={styles.label}>Spend</p>
        {campaigns === undefined ? (
          <Unavailable />
        ) : (
          <>
            <p className={styles.value}>{formatIdrCompact(campaigns.totalSpend)}</p>
            <p className={`${styles.delta} ${styles.deltaNeutral}`}>
              {datePresetLabel(campaigns.datePreset)}
            </p>
          </>
        )}
      </div>

      <div className={styles.cell}>
        <p className={styles.label}>AI score rata-rata</p>
        {avgScore === undefined ? (
          <Unavailable />
        ) : (
          <>
            <p className={styles.value}>{avgScore.toFixed(0)}</p>
            <p
              className={`${styles.delta} ${avgScoreDelta === undefined ? styles.deltaNeutral : deltaClass(avgScoreDelta)}`}
            >
              {avgScoreDelta === undefined
                ? "belum ada perbandingan"
                : `${avgScoreDelta >= 0 ? "+" : ""}${avgScoreDelta.toFixed(1)} vs minggu lalu`}
            </p>
          </>
        )}
      </div>

      <div className={styles.cell}>
        <p className={styles.label}>Recycling terkirim hari ini</p>
        {recycling === undefined ? (
          <Unavailable />
        ) : (
          <>
            <p className={styles.value}>{formatNumber(recycling.sentToday)}</p>
            <p className={`${styles.delta} ${styles.deltaNeutral}`}>
              {recycling.respondedToday} respon · {recycling.onCooldown} cooldown
            </p>
          </>
        )}
      </div>
    </div>
  );
}
