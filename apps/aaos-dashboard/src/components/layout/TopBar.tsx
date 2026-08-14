"use client";

export interface TopBarProps {
  readonly title: string;
  readonly userEmail?: string;
  readonly onSignOut?: () => void;
}

/** Page title + user menu (spec "components/layout/TopBar.tsx"). */
export function TopBar({ title, userEmail, onSignOut }: TopBarProps): React.ReactElement {
  return (
    <header className="flex items-center justify-between border-b border-hairline-sidebar bg-surface-card px-6 py-4">
      <h1 className="text-[26px] font-semibold -tracking-[0.5px] text-ink">{title}</h1>
      <div className="flex items-center gap-3">
        {userEmail !== undefined ? (
          <span className="text-sm text-ink-muted">{userEmail}</span>
        ) : null}
        {onSignOut !== undefined ? (
          <button
            type="button"
            onClick={onSignOut}
            className="btn-press rounded-button border border-hairline-card px-3 py-1.5 text-sm font-medium text-[#3A3A3C] hover:bg-surface-page"
          >
            Keluar
          </button>
        ) : null}
      </div>
    </header>
  );
}
