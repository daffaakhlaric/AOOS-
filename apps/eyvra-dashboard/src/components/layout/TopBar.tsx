"use client";

import { SectionBar } from "@/components/ui/SectionBar";

import styles from "./TopBar.module.css";

export interface TopBarProps {
  readonly title: string;
  readonly userEmail?: string;
  readonly onSignOut?: () => void;
  /**
   * Real CSS color (typically a `--v2-*` token via `var(--v2-xxx)`) for a `SectionBar` accent
   * rendered next to the title (AAOS Colorful Brand Guideline v2, Phase B4). Optional and
   * omitted by default so the ~30 other real callers of this shared header keep their plain
   * title — only the 7 recolored page groups pass this.
   */
  readonly accentColor?: string;
}

/**
 * Sticky page header (spec "components/layout/TopBar.tsx"; TOTAL UI REBUILD "=== PAGE HEADER ==="
 * — sticky/blurred 56px bar, 24px/600-weight title, right-aligned actions). The spec's left slot
 * is a full "AAOS / Samantha / Data Iklan"-style breadcrumb; this component only ever receives a
 * single `title` string from its callers (every `page.tsx` passes one page name, never a
 * breadcrumb trail), so it renders that title directly rather than fabricating breadcrumb
 * segments no caller supplies.
 */
export function TopBar({
  title,
  userEmail,
  onSignOut,
  accentColor,
}: TopBarProps): React.ReactElement {
  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        {accentColor !== undefined ? <SectionBar color={accentColor} /> : null}
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.actions}>
        {userEmail !== undefined ? <span className={styles.userEmail}>{userEmail}</span> : null}
        {onSignOut !== undefined ? (
          <button type="button" onClick={onSignOut} className={styles.signOut}>
            Keluar
          </button>
        ) : null}
      </div>
    </header>
  );
}
