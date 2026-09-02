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
 *
 * COLORFUL BRAND GUIDELINE V2 (Phase B3) — REAL DATA-SHAPE DEVIATION from Prompt 3's
 * `KPI_STYLES` table: that table is keyed by `hotLeads`/`avgCpl`/`campaigns`/`spend`/`waLeads`/
 * `aiScore`. This component's real 6 cells are "HOT leads hari ini" / "Leads HOT/WARM/COLD" /
 * "Campaign aktif" / "Spend" / "AI score rata-rata" / "Recycling terkirim hari ini" — there is no
 * `avgCpl` or `waLeads` cell anywhere in the real render (no CPL-per-lead or WA-lead-count field
 * exists on `OverviewResponseDto`). `CELL_ICON_STYLE` below maps each REAL cell to the closest
 * matching `--v2-*` token pairing instead of inventing new colors:
 *   - "HOT leads hari ini"        -> spec's `hotLeads` pairing verbatim (`--v2-hot`/`--v2-hot-light`)
 *   - "Leads HOT/WARM/COLD"       -> `--v2-warm`/`--v2-warm-light` (a second, distinct lead-count
 *                                    cell — reuses the WARM tier's color since it summarizes all 3
 *                                    tiers, not just HOT again)
 *   - "Campaign aktif"            -> spec's `campaigns` pairing verbatim (`--v2-kai`/`--v2-kai-light`,
 *                                    i.e. #7C3AED/#EDE9FE)
 *   - "Spend"                     -> spec's `spend` pairing verbatim (`--v2-karen`/`--v2-karen-light`)
 *   - "AI score rata-rata"        -> spec's `aiScore` pairing verbatim (`--v2-learning`/
 *                                    `--v2-learning-bg`, i.e. #6366F1/#E0E7FF)
 *   - "Recycling terkirim hari ini" -> `--v2-menu-campaigns` (#8B5CF6, the same violet Prompt 5's
 *                                    `Badge` type `RECYCLING` already uses) / `--v2-kai-light` tint
 * Also no Tabler icon font (`ti-*`) is installed anywhere in this repo (verified via repo-wide
 * grep) — the spec's `<i className="ti ti-flame">` etc. is replaced with a plain emoji glyph per
 * cell, the same "no icon font, use emoji" convention `InsightBar.tsx`'s real 💡 already
 * establishes in this same directory.
 */
export interface KpiStripData {
  readonly leads?: OverviewLeadsSummaryDto;
  readonly campaigns?: OverviewCampaignsSummaryDto;
  readonly agentStatus: readonly OverviewAgentScoreDto[];
  readonly recycling?: OverviewRecyclingSummaryDto;
}

interface CellIconStyle {
  readonly icon: string;
  readonly iconColor: string;
  readonly iconBg: string;
  readonly valueColor?: string;
}

const CELL_ICON_STYLE: Readonly<{
  hot: CellIconStyle;
  leadsBreakdown: CellIconStyle;
  campaigns: CellIconStyle;
  spend: CellIconStyle;
  aiScore: CellIconStyle;
  recycling: CellIconStyle;
}> = {
  hot: {
    icon: "🔥",
    iconColor: "var(--v2-hot)",
    iconBg: "var(--v2-hot-light)",
    valueColor: "var(--v2-hot)",
  },
  leadsBreakdown: { icon: "👥", iconColor: "var(--v2-warm)", iconBg: "var(--v2-warm-light)" },
  campaigns: { icon: "📢", iconColor: "var(--v2-kai)", iconBg: "var(--v2-kai-light)" },
  spend: { icon: "💵", iconColor: "var(--v2-karen)", iconBg: "var(--v2-karen-light)" },
  aiScore: {
    icon: "🧠",
    iconColor: "var(--v2-learning)",
    iconBg: "var(--v2-learning-bg)",
    valueColor: "var(--v2-learning)",
  },
  recycling: { icon: "♻️", iconColor: "var(--v2-menu-campaigns)", iconBg: "var(--v2-kai-light)" },
};

function IconBox({ style }: { readonly style: CellIconStyle }): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className={styles.iconBox}
      style={{ background: style.iconBg, color: style.iconColor }}
    >
      {style.icon}
    </span>
  );
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
        <IconBox style={CELL_ICON_STYLE.hot} />
        <div className={styles.body}>
          <p className={styles.label}>HOT leads hari ini</p>
          {leads === undefined ? (
            <Unavailable />
          ) : (
            <>
              <p className={styles.value} style={{ color: CELL_ICON_STYLE.hot.valueColor }}>
                {formatNumber(leads.hotToday)}
              </p>
              <p className={`${styles.delta} ${deltaClass(leads.hotDeltaVsYesterday)}`}>
                {leads.hotDeltaVsYesterday >= 0 ? "+" : ""}
                {formatNumber(leads.hotDeltaVsYesterday)} dari kemarin
              </p>
            </>
          )}
        </div>
      </div>

      <div className={styles.cell}>
        <IconBox style={CELL_ICON_STYLE.leadsBreakdown} />
        <div className={styles.body}>
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
      </div>

      <div className={styles.cell}>
        <IconBox style={CELL_ICON_STYLE.campaigns} />
        <div className={styles.body}>
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
      </div>

      <div className={styles.cell}>
        <IconBox style={CELL_ICON_STYLE.spend} />
        <div className={styles.body}>
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
      </div>

      <div className={styles.cell}>
        <IconBox style={CELL_ICON_STYLE.aiScore} />
        <div className={styles.body}>
          <p className={styles.label}>AI score rata-rata</p>
          {avgScore === undefined ? (
            <Unavailable />
          ) : (
            <>
              <p className={styles.value} style={{ color: CELL_ICON_STYLE.aiScore.valueColor }}>
                {avgScore.toFixed(0)}
              </p>
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
      </div>

      <div className={styles.cell}>
        <IconBox style={CELL_ICON_STYLE.recycling} />
        <div className={styles.body}>
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
    </div>
  );
}
