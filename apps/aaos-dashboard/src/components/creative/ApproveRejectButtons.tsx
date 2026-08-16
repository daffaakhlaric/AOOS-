import styles from "./ApproveRejectButtons.module.css";

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
    <div className={styles.row}>
      <button type="button" onClick={onApprove} disabled={disabled} className={styles.approve}>
        ✅ Approve & Launch
      </button>
      <button type="button" onClick={onReject} disabled={disabled} className={styles.reject}>
        ❌ Reject
      </button>
    </div>
  );
}
