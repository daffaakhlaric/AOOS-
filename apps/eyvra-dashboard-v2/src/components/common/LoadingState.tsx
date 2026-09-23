import styles from "./LoadingState.module.css";

export function LoadingState({
  processLabel,
  testId,
}: {
  readonly processLabel?: string;
  readonly testId?: string;
}): React.ReactElement {
  return (
    <div className={styles.wrap} role="status" data-testid={testId ?? "loading-state"}>
      <span className={styles.skeleton} aria-hidden="true" />
      <span>{processLabel ?? "Memuat..."}</span>
    </div>
  );
}
