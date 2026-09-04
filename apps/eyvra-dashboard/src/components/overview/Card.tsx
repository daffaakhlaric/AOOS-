import { SectionBar } from "@/components/ui/SectionBar";

import styles from "./Card.module.css";

/**
 * Plain titled card wrapper — reused by every Overview Monitor section (spec's own mockup
 * `<Card title="...">` pattern, `docs/PROMPT-EYVRA-OVERVIEW-MONITOR-PAGE.md`), restyled to this
 * codebase's real `--radius-lg`/`--border`/`--white` tokens (matching `DashboardClient.module.css`'s
 * own `.panel`).
 *
 * COLORFUL BRAND GUIDELINE V2 (Phase B3, Prompt 10 "SectionBar"): wires in Phase B2's
 * `SectionBar` primitive (`src/components/ui/SectionBar.tsx`, built but not yet wired into
 * anything) via a new, optional `accentColor` prop — when provided, a colored 4px bar renders next
 * to the title, per `OverviewMonitorClient.tsx`'s own section->color mapping. Backward compatible:
 * every existing caller that omits `accentColor` renders identically to before (no bar).
 */
export function Card({
  title,
  accentColor,
  children,
}: {
  readonly title: string;
  readonly accentColor?: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className={styles.card}>
      <p className={styles.title}>
        {accentColor !== undefined ? <SectionBar color={accentColor} /> : null}
        {title}
      </p>
      {children}
    </section>
  );
}
