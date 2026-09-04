import { formatDateId } from "@/lib/formatters";
import type { CapiHealthSignalDto } from "@/types/dashboard.types";

import styles from "./CapiHealthCard.module.css";

/** `[0, 10]`, matches `EmqScore`'s own real domain range — see `@aos/capi-connector`'s `EmqScore` value object. */
function scoreColor(score: number): string {
  if (score >= 7) return "var(--green-600, #16a34a)";
  if (score >= 4) return "var(--samantha-orange, #e8580c)";
  return "var(--red-600, #dc2626)";
}

/**
 * AAOS-META-MCP-BONUS-TOOLS (Tool 4 — "CAPI Health") — renders ONLY the real fields
 * `apps/aaos-api`'s `EmqReport` actually has (`pixelId`/`score`/`eventsReceived`/`capturedAt`).
 * Deliberately does NOT render the original spec's imagined per-event-type breakdown table or
 * issues list — confirmed via direct read that `EmqReport` (`@aos/capi-connector`) has no such
 * fields; rendering them would mean fabricating data. Consumes `IntelligenceSignalsDto.capiHealth`
 * from the SAME `/api/intelligence/signals`|`/refresh` fetch `IntelligenceSignalsCard` already
 * does — no second, parallel data fetch.
 */
export function CapiHealthCard({
  capiHealth,
}: {
  readonly capiHealth: CapiHealthSignalDto;
}): React.ReactElement {
  if (!capiHealth.available) {
    return (
      <div data-testid="capi-health-card" className={styles.card}>
        <p className={styles.title}>📡 CAPI Health</p>
        <p className={styles.mutedText}>{capiHealth.reasoning}</p>
      </div>
    );
  }

  return (
    <div data-testid="capi-health-card" className={styles.card}>
      <p className={styles.title}>📡 CAPI Health</p>
      <div className={styles.statsRow}>
        <div>
          <div className={styles.statLabel}>Match Quality Score</div>
          <div className={styles.statValue} style={{ color: scoreColor(capiHealth.score) }}>
            {capiHealth.score.toFixed(1)}/10
          </div>
        </div>
        <div>
          <div className={styles.statLabel}>Events Received</div>
          <div className={styles.statValue}>{capiHealth.eventsReceived}</div>
        </div>
      </div>
      <p className={styles.mutedText}>
        Pixel {capiHealth.pixelId} · terakhir diambil {formatDateId(capiHealth.capturedAt)}
      </p>
    </div>
  );
}
