export interface ErrorCardProps {
  readonly message: string;
}

/** A red-bordered error card — reused verbatim from `apps/aaos-dashboard`'s component (spec "components/ui/ErrorCard.tsx"). */
export function ErrorCard({ message }: ErrorCardProps): React.ReactElement {
  return (
    <div
      data-testid="error-card"
      role="alert"
      className="rounded-card border border-brand-danger/30 bg-brand-danger/5 p-4 text-sm text-brand-danger shadow-card"
    >
      <p className="font-semibold">Terjadi kesalahan</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}
