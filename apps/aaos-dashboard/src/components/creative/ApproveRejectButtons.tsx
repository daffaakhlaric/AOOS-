export interface ApproveRejectButtonsProps {
  readonly onApprove: () => void;
  readonly onReject: () => void;
  readonly disabled?: boolean;
}

/** Approve/Reject action buttons (spec "components/creative/ApproveRejectButtons.tsx" — mockup "[✅ Approve & Launch]  [❌ Reject]"). */
export function ApproveRejectButtons({
  onApprove,
  onReject,
  disabled = false,
}: ApproveRejectButtonsProps): React.ReactElement {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onApprove}
        disabled={disabled}
        className="rounded-button bg-brand-success px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        ✅ Approve & Launch
      </button>
      <button
        type="button"
        onClick={onReject}
        disabled={disabled}
        className="rounded-button bg-brand-danger px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        ❌ Reject
      </button>
    </div>
  );
}
