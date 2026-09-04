import type { AnomalySignalsDto } from "@/types/dashboard.types";

import styles from "./AnomalyAlert.module.css";

/**
 * AAOS-META-MCP-BONUS-TOOLS (Tool 1 — "Anomaly Signal", honestly scoped down) — renders ONLY real
 * `FREQUENCY_HIGH` anomalies from `apps/aaos-api`'s `AnomalyDetector.detectFrequencyHigh` (already
 * detected server-side against a real, cited frequency threshold). Every other anomaly type from
 * the original spec (`SPEND_DROP`/`SPEND_SPIKE`/`CPL_INCREASE`/`CTR_DROP`/`DELIVERY_ISSUE`/
 * `LOW_QUALITY_SCORE`) is deferred — this app has no historical/time-series metrics storage to
 * compute them from honestly, so no such row type is ever rendered here. Consumes
 * `IntelligenceSignalsDto.anomalies` from the SAME `/api/intelligence/signals`|`/refresh` fetch
 * `IntelligenceSignalsCard` already does — no second, parallel data fetch.
 *
 * Renders nothing when there are zero anomalies — an "all clear" state isn't an alert.
 */
export function AnomalyAlert({
  anomalies,
}: {
  readonly anomalies: AnomalySignalsDto;
}): React.ReactElement | null {
  if (anomalies.anomalies.length === 0) {
    return null;
  }

  return (
    <div data-testid="anomaly-alert" className={styles.card}>
      <p className={styles.title}>⚠ {anomalies.anomalies.length} Anomali Terdeteksi</p>
      <ul className={styles.list}>
        {anomalies.anomalies.map((anomaly) => (
          <li key={anomaly.adId} className={styles.row}>
            <span className={styles.badge} data-severity={anomaly.severity} aria-hidden="true">
              {anomaly.severity}
            </span>
            <div>
              <div className={styles.adName}>{anomaly.adName}</div>
              <div className={styles.message}>{anomaly.message}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
