import type { ProgressSummary } from "@/lib/stress-test-progress";
import styles from "./history.module.css";

/**
 * Real per-evaluator step checklist, e.g. "Persona 3/5 ✓ · Copy ✓ · Fact berjalan — 2/4 evaluator".
 * Rendered only from backend-persisted progress; callers fall back to "Sedang dievaluasi" otherwise.
 */
export function RunProgressChecklist({
  summary,
  testId = "run-progress",
}: {
  readonly summary: ProgressSummary;
  readonly testId?: string;
}): React.ReactElement {
  return (
    <div data-testid={testId} aria-label={summary.text} title={summary.text}>
      <ul className={styles.progressList}>
        {summary.steps.map((step) => (
          <li
            key={step.key}
            className={`${styles.progressItem} ${styles[`progress_${step.state}`] ?? ""}`}
            data-testid="run-progress-step"
            data-state={step.state}
          >
            {step.state === "RUNNING" ? (
              <span className={styles.spinner} aria-hidden="true" />
            ) : null}
            {step.label}{" "}
            {step.state === "RUNNING" || step.state === "PENDING" ? step.stateLabel : step.icon}
          </li>
        ))}
      </ul>
      <span className={styles.sub}>
        {summary.settled}/{summary.total} evaluator
      </span>
    </div>
  );
}
