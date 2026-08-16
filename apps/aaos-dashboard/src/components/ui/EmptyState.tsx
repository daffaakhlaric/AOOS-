import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
}

/** A neutral "nothing here yet" placeholder (spec "components/ui/EmptyState.tsx"). */
export function EmptyState({ title, description }: EmptyStateProps): React.ReactElement {
  return (
    <div data-testid="empty-state" className={styles.wrap}>
      <p className={styles.title}>{title}</p>
      {description !== undefined ? <p className={styles.description}>{description}</p> : null}
    </div>
  );
}
