import styles from "./SectionBar.module.css";

export interface SectionBarProps {
  /** Any real CSS color value — typically a `--v2-*` token via `var(--v2-xxx)`. */
  readonly color: string;
}

/**
 * Colored 4px accent bar primitive (AAOS Colorful Brand Guideline v2, Phase B2), adapted from
 * `docs/PROMPT-EYVRA-COLORFUL-BRAND-GUIDELINE-V2.md`'s Prompt 10 "PAGE LAYOUT & SECTION BARS"
 * `SectionBar` snippet and Prompt 6's "Section card header" colored-left-bar note.
 *
 * Deliberately NOT the spec's full `SectionHeader` (title + subtitle + this bar combined) — the
 * real `Card` component (`src/components/overview/Card.tsx`) already renders its own title, so a
 * full header replacement would duplicate that. This is only the bar itself: a drop-in accent
 * element real `Card`/page-header usages can place next to their existing title in a later phase
 * (B3/B4). Not wired into `Card.tsx` or any page by this phase.
 */
export function SectionBar({ color }: SectionBarProps): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      data-testid="section-bar"
      className={styles.bar}
      style={{ background: color }}
    />
  );
}

export default SectionBar;
