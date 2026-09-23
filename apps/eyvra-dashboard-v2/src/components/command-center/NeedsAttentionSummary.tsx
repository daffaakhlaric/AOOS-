import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { formatIdrCompact } from "@/lib/formatters";
import type { AccountSummaryResponseDto, SamanthaSignalType } from "@/types/dashboard.types";

import { PanelHeader, SummaryRow } from "./SummaryPanelParts";
import styles from "./AttentionSummary.module.css";

const NON_ACTIONABLE_DECISIONS = new Set(["NO_ACTION", "MONITOR"]);

/**
 * Real account-wide attention summary, in the reference card's shape (icon header + "N items"
 * counter, then rows of [dot] [value] [bold label] / [muted sub-line]).
 *
 * Every number traces to the real account-summary aggregate (`decision.impact`,
 * `diagnosis.rootCause`, campaign `spend`). The one row with no real source — tracking/pixel
 * health, which `campaign-health.ts` documents as permanently `UNKNOWN` in this codebase — renders
 * an honest em-dash rather than a `0`, because "no tracking problems detected" and "we cannot see
 * tracking at all" are different claims.
 *
 * Sub-lines deliberately do NOT quote thresholds (the reference mock says "CTR down > 40%"): the
 * real detector thresholds live in `signal-engine.ts` and aren't carried in this payload, so naming
 * a specific number here would be invented precision.
 */
export function NeedsAttentionSummary({
  summary,
  error,
}: {
  readonly summary?: AccountSummaryResponseDto;
  readonly error?: string;
}): React.ReactElement {
  if (error !== undefined) {
    return (
      <div className={`${styles.panel} ${styles.panelAttention}`} data-testid="cc-panel-attention">
        <PanelHeader label="Needs Attention" countClassName={styles.totalBadge} />
        <ErrorState message={error} />
      </div>
    );
  }

  if (summary === undefined) {
    return (
      <div className={`${styles.panel} ${styles.panelAttention}`} data-testid="cc-panel-attention">
        <PanelHeader label="Needs Attention" countClassName={styles.totalBadge} />
        <LoadingState processLabel="Samantha sedang menganalisis campaign..." />
      </div>
    );
  }

  const attention = summary.campaigns.filter(
    (entry) => !NON_ACTIONABLE_DECISIONS.has(entry.decision.decision),
  );
  const attentionSpend = attention.reduce((sum, entry) => sum + entry.spend, 0);
  const criticalCount = attention.filter((entry) => entry.decision.impact === "CRITICAL").length;
  const highCount = attention.filter((entry) => entry.decision.impact === "HIGH").length;

  const rootCauseCounts = new Map<SamanthaSignalType, number>();
  for (const entry of attention) {
    const rootCause = entry.diagnosis.rootCause;
    if (rootCause === undefined) continue;
    rootCauseCounts.set(rootCause, (rootCauseCounts.get(rootCause) ?? 0) + 1);
  }
  const fatigueCount = rootCauseCounts.get("CREATIVE_FATIGUE") ?? 0;

  return (
    <div className={`${styles.panel} ${styles.panelAttention}`} data-testid="cc-panel-attention">
      <PanelHeader
        label="Needs Attention"
        count={attention.length}
        countClassName={styles.totalBadge}
      />
      <div className={styles.rows}>
        <SummaryRow
          dotClassName={styles.dotCritical}
          value={String(criticalCount)}
          label="Critical campaigns"
          note={`Butuh tindakan segera · ${String(highCount)} high impact`}
        />
        <SummaryRow
          dotClassName={styles.dotCritical}
          value={String(fatigueCount)}
          label="Creative fatigue"
          note="Performa creative menurun, perlu refresh dari Kai"
        />
        <SummaryRow
          dotClassName={styles.dotMuted}
          label="Tracking issues"
          note="Data tracking/pixel belum tersedia di sistem ini"
          unavailable
        />
        <SummaryRow
          dotClassName={styles.dotWarning}
          value={formatIdrCompact(attentionSpend)}
          label="Potential waste"
          note="Spend pada campaign yang perlu tindakan"
        />
      </div>
      {summary.campaignsCapped ? (
        <p className={styles.capNote}>
          Analisis dibatasi {summary.campaignsAnalyzed} campaign teratas.
        </p>
      ) : null}
    </div>
  );
}
