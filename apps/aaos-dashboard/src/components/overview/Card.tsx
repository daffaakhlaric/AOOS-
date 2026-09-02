import styles from "./Card.module.css";

/** Plain titled card wrapper — reused by every Overview Monitor section (spec's own mockup `<Card title="...">` pattern, `docs/PROMPT-EYVRA-OVERVIEW-MONITOR-PAGE.md`), restyled to this codebase's real `--radius-lg`/`--border`/`--white` tokens (matching `DashboardClient.module.css`'s own `.panel`). */
export function Card({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className={styles.card}>
      <p className={styles.title}>{title}</p>
      {children}
    </section>
  );
}
