export interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
}

/** A neutral "nothing here yet" placeholder (spec "components/ui/EmptyState.tsx"). */
export function EmptyState({ title, description }: EmptyStateProps): React.ReactElement {
  return (
    <div
      data-testid="empty-state"
      className="rounded-card border border-dashed border-hairline-card bg-surface-card p-8 text-center"
    >
      <p className="font-semibold text-ink">{title}</p>
      {description !== undefined ? (
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      ) : null}
    </div>
  );
}
