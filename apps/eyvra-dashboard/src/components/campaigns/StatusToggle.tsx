import styles from "./StatusToggle.module.css";

export interface StatusToggleProps {
  readonly status: string;
  readonly onPause: () => void;
  readonly disabled?: boolean;
}

/**
 * AAOS-CAMPAIGNS-UNIFIED-PAGE — the unified table's per-campaign status toggle.
 *
 * REAL, deliberately ONE-DIRECTIONAL: investigated the real Meta-mutating execution path
 * (`packages/meta-ads-connector`'s `ExecuteVerdict`/`Verdict` enum — SCALE/KEEP/REVIEW/REFRESH/
 * FIX/PAUSE — and `IMetaAdsClient`) and found there is no real "activate/resume a paused
 * campaign" verdict or client method anywhere in this codebase; only `pauseCampaign` (`status:
 * "PAUSED"`) exists. So this control can only ever PAUSE a real ACTIVE campaign (via the same
 * `POST /api/verdicts` → `executeVerdict` call `CampaignTree`'s own "⚡ Execute" button already
 * uses, with `verdict: "PAUSE"`, `targetType: "campaign"`) — never a fabricated "resume" action.
 * A campaign already `PAUSED` renders the toggle in its paused position, disabled, with a real
 * honest label explaining why (rather than a resume button that would silently no-op or 404
 * against a backend action that doesn't exist).
 */
export function StatusToggle({ status, onPause, disabled }: StatusToggleProps): React.ReactElement {
  const isActive = status === "ACTIVE";
  return (
    <div className={styles.wrap}>
      <button
        type="button"
        role="switch"
        aria-checked={isActive}
        aria-label={isActive ? "Pause campaign" : "Campaign sudah dihentikan"}
        data-testid="status-toggle"
        data-status={status}
        disabled={disabled === true || !isActive}
        onClick={() => {
          if (isActive) {
            onPause();
          }
        }}
        className={`${styles.toggle} ${isActive ? styles.toggleOn : styles.toggleOff}`}
      >
        <span className={styles.knob} />
      </button>
      {!isActive ? (
        <span
          className={styles.pausedNote}
          title="Tidak ada verdict/aksi 'ACTIVATE' nyata di sistem ini — hanya PAUSE yang bisa dieksekusi otomatis."
        >
          dihentikan
        </span>
      ) : null}
    </div>
  );
}
