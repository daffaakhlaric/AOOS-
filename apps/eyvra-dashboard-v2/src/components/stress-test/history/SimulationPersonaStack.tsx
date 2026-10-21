import styles from "./history.module.css";

const MAX_AVATARS = 4;

/**
 * Small initials avatar stack. Persona names live only in the tooltip (`title`) and the
 * screen-reader label — never as visible text in the dense table.
 */
export function SimulationPersonaStack({
  personas,
  countLabel,
  testId,
}: {
  readonly personas: readonly {
    readonly id?: string;
    readonly personaId?: string;
    readonly label: string;
    readonly initials: string;
  }[];
  /** Visible text next to the stack; defaults to the persona count. */
  readonly countLabel?: string;
  readonly testId?: string;
}): React.ReactElement {
  if (personas.length === 0) return <span className={styles.dash}>—</span>;
  const names = personas.map((p) => p.label).join(", ");
  const shown = personas.slice(0, MAX_AVATARS);
  const more = personas.length - shown.length;
  return (
    <span
      className={styles.stack}
      title={names}
      aria-label={`Persona: ${names}`}
      data-testid={testId}
    >
      <span className={styles.avatars} aria-hidden="true">
        {shown.map((p, i) => (
          <span key={p.id ?? p.personaId ?? String(i)} className={styles.avatar}>
            {p.initials}
          </span>
        ))}
        {more > 0 ? <span className={`${styles.avatar} ${styles.avatarMore}`}>+{more}</span> : null}
      </span>
      <span aria-hidden="true">{countLabel ?? String(personas.length)}</span>
    </span>
  );
}
