/** A simple accessible loading indicator (spec "components/ui/LoadingSpinner.tsx"). */
export function LoadingSpinner(): React.ReactElement {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center p-8">
      <div
        data-testid="loading-spinner"
        className="h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-brand-primary"
      />
      <span className="sr-only">Memuat...</span>
    </div>
  );
}
