import { Card } from "@/components/common/Card";
import styles from "./result.module.css";

export const EXPERIMENT_UNAVAILABLE_REASON =
  "Pembuatan eksperimen dari Stress Test belum tersedia — endpoint A/B test yang ada saat ini membutuhkan field khusus otomotif dan belum terhubung ke hasil uji ketahanan.";

/** Right rail "Buat Eksperimen" — intentionally disabled; no real create path is wired. */
export function ExperimentDraftCard(): React.ReactElement {
  return (
    <Card title="Buat Eksperimen" variant="compact" testId="stress-test-experiment-card">
      <p className={styles.muted}>
        Uji creative hasil revisi di Meta sebagai eksperimen A/B setelah creative diperbaiki.
      </p>
      <button
        type="button"
        className={styles.button}
        disabled
        title={EXPERIMENT_UNAVAILABLE_REASON}
        aria-describedby="stress-test-experiment-reason"
        data-testid="stress-test-experiment-button"
        style={{ marginTop: 10 }}
      >
        Buat Draft Eksperimen
      </button>
      <p id="stress-test-experiment-reason" className={styles.note}>
        {EXPERIMENT_UNAVAILABLE_REASON}
      </p>
    </Card>
  );
}
