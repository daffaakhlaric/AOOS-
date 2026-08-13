export interface RealtimeBadgeProps {
  readonly connected: boolean;
}

/** "🔴 Live" indicator (spec mockup: "🔴 Live"). Shows a muted "Menghubungkan..." state while the Realtime channel is still subscribing. */
export function RealtimeBadge({ connected }: RealtimeBadgeProps): React.ReactElement {
  if (!connected) {
    return (
      <span data-testid="realtime-badge" className="text-xs font-medium text-ink-muted">
        Menghubungkan...
      </span>
    );
  }
  return (
    <span
      data-testid="realtime-badge"
      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-danger"
    >
      <span aria-hidden="true">🔴</span> Live
    </span>
  );
}
