import styles from "./Card.module.css";

export type CardVariant = "default" | "hero" | "compact";

export function Card({
  title,
  subtitle,
  action,
  children,
  testId,
  variant = "default",
}: {
  readonly title?: string;
  readonly subtitle?: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly testId?: string;
  readonly variant?: CardVariant;
}): React.ReactElement {
  const variantClass =
    variant === "hero" ? styles.hero : variant === "compact" ? styles.compact : "";
  return (
    <section className={`${styles.card} ${variantClass}`} data-testid={testId}>
      {title !== undefined ? (
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>{title}</h2>
            {subtitle !== undefined ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
