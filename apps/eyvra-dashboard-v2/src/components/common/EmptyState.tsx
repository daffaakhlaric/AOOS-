import styles from "./EmptyState.module.css";

export function EmptyState({
  title,
  description,
  action,
  testId,
  compact,
}: {
  readonly title: string;
  readonly description?: string;
  readonly action?: React.ReactNode;
  readonly testId?: string;
  readonly compact?: boolean;
}): React.ReactElement {
  return (
    <div
      className={`${styles.wrap} ${compact === true ? styles.compact : ""}`}
      data-testid={testId ?? "empty-state"}
    >
      <p className={styles.title}>{title}</p>
      {description !== undefined ? <p className={styles.description}>{description}</p> : null}
      {action !== undefined ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
