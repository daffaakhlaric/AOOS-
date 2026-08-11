export interface ApproveButtonProps {
  readonly approved: boolean;
  readonly onApprove: () => void;
  readonly disabled?: boolean;
  readonly label?: string;
}

/**
 * DSS approve Jessy for deploy (spec "components/simulator/ApproveButton.tsx").
 *
 * Scope boundary (design resolution #3, spec "Does NOT": "store data in Supabase — all in-memory
 * per session"): this button is a client-only, in-session action. Clicking it only flips local UI
 * state the parent page owns (`approved`) — it never calls a persistence backend, writes to a
 * database, or hits an API route. There is no `/api/approve` route and none should be added; the
 * actual WhatsApp deploy remains an explicit manual step outside this app (spec "Does NOT: Deploy
 * Jessy to WhatsApp").
 */
export function ApproveButton({
  approved,
  onApprove,
  disabled = false,
  label = "Approve Jessy",
}: ApproveButtonProps): React.ReactElement {
  return (
    <div className="flex flex-col items-stretch gap-2">
      <button
        type="button"
        data-testid="approve-button"
        onClick={onApprove}
        disabled={disabled || approved}
        className="w-full rounded-button bg-brand-success px-4 py-2 text-sm font-semibold text-white shadow-card transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        {approved ? "✅ Disetujui" : `✅ ${label}`}
      </button>
      {approved && (
        <p data-testid="approve-confirmation" className="text-center text-xs text-brand-success">
          Jessy disetujui untuk sesi ini — siap untuk langkah deploy manual ke WhatsApp.
        </p>
      )}
    </div>
  );
}
