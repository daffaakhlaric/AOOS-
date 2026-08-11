export interface LoadingSpinnerProps {
  readonly label?: string;
}

/** A simple spinner + label (spec "components/ui/LoadingSpinner.tsx"). */
export function LoadingSpinner({ label = "Memuat..." }: LoadingSpinnerProps): React.ReactElement {
  return (
    <div
      data-testid="loading-spinner"
      className="flex items-center gap-2 text-sm text-ink-muted"
      role="status"
    >
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-hairline border-t-brand-primary"
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
