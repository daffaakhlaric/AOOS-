import styles from "./result.module.css";

const STEPS = [
  "Konteks & Creative",
  "Persona",
  "Evaluator",
  "Skoring",
  "Hasil & Rekomendasi",
] as const;

/** Static "all steps done" stepper — only rendered for a run with a real evaluated result. */
export function ResultStepper(): React.ReactElement {
  return (
    <ol
      className={styles.stepper}
      aria-label="Tahapan run"
      data-testid="stress-test-result-stepper"
    >
      {STEPS.map((label, i) => (
        <li key={label}>
          <span className={styles.stepCheck} aria-hidden="true">
            ✓
          </span>
          {i + 1}. {label}
        </li>
      ))}
    </ol>
  );
}
