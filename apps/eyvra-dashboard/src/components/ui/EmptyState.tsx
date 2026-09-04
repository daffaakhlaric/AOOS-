import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
  /**
   * Optional large emoji shown above the title (FINAL UI REBUILD spec "GLOBAL: EMPTY STATES" —
   * "Icon: emoji besar (48px) sesuai halaman"). Purely decorative per-page flourish; every
   * existing caller omits it and keeps rendering exactly as before.
   */
  readonly icon?: string;
  /**
   * Optional call-to-action rendered below the description (AAOS-SALES-MGMT-CRM-AUTH — Part 1's
   * "Belum ada sales" empty state needs a real "+ Tambah Sales Human" button, not just static
   * text). Every pre-existing caller omits it and keeps rendering exactly as before.
   */
  readonly action?: React.ReactNode;
}

/** A neutral "nothing here yet" placeholder (spec "components/ui/EmptyState.tsx"). */
export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps): React.ReactElement {
  return (
    <div data-testid="empty-state" className={styles.wrap}>
      {icon !== undefined ? (
        <p aria-hidden="true" className={styles.icon}>
          {icon}
        </p>
      ) : null}
      <p className={styles.title}>{title}</p>
      {description !== undefined ? <p className={styles.description}>{description}</p> : null}
      {action !== undefined ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
