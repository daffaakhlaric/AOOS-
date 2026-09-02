import type { OverviewInsightDto } from "@/types/dashboard.types";

import styles from "./InsightBar.module.css";

/**
 * AI-generated daily insight bar (spec `docs/PROMPT-EYVRA-OVERVIEW-MONITOR-PAGE.md` "BAGIAN 2").
 * Consumes O1's real `OverviewResponseDto.insight` field DIRECTLY — that field is never
 * `undefined` (it's the DTO's one required, not-optional-in-degrade section: `LlmService
 * .generateDailyInsight` always resolves, real success or a real, typed `available: false`
 * fallback, per `LlmUnavailableResponseDto`'s own established contract). So this component has
 * exactly 2 real states — `available: true` (the real generated summary) or `available: false` (an
 * honest reason/message, e.g. no `OPENAI_API_KEY`, rate-limited, provider error) — never a 3rd
 * "loading"/fabricated placeholder state of its own.
 */
export function InsightBar({
  insight,
}: {
  readonly insight: OverviewInsightDto;
}): React.ReactElement {
  if (!insight.available) {
    return (
      <div className={`${styles.bar} ${styles.unavailable}`} data-testid="insight-bar-unavailable">
        <span aria-hidden="true">💡</span>
        <span className={styles.summary}>Insight AI tidak tersedia — {insight.message}</span>
      </div>
    );
  }

  return (
    <div className={styles.bar} data-testid="insight-bar-available">
      <span aria-hidden="true">💡</span>
      <span className={styles.summary}>{insight.summary}</span>
    </div>
  );
}
