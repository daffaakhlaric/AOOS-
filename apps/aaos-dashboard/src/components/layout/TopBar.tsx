"use client";

import styles from "./TopBar.module.css";

export interface TopBarProps {
  readonly title: string;
  readonly userEmail?: string;
  readonly onSignOut?: () => void;
}

/**
 * Sticky page header (spec "components/layout/TopBar.tsx"; TOTAL UI REBUILD "=== PAGE HEADER ==="
 * — sticky/blurred 56px bar, 24px/600-weight title, right-aligned actions). The spec's left slot
 * is a full "AAOS / Samantha / Data Iklan"-style breadcrumb; this component only ever receives a
 * single `title` string from its callers (every `page.tsx` passes one page name, never a
 * breadcrumb trail), so it renders that title directly rather than fabricating breadcrumb
 * segments no caller supplies.
 */
export function TopBar({ title, userEmail, onSignOut }: TopBarProps): React.ReactElement {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
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
