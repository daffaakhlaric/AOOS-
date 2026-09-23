import styles from "./ErrorState.module.css";

export function ErrorState({
  message,
  testId,
}: {
  readonly message: string;
  readonly testId?: string;
}): React.ReactElement {
  return (
    <div className={styles.wrap} data-testid={testId ?? "error-state"}>
      <p className={styles.title}>Gagal memuat data</p>
      <p className={styles.message}>{message}</p>
    </div>
  );
}
