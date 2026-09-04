import styles from "./Badge.module.css";

/**
 * Real `BadgeType`s this repo actually has status values for (AAOS Colorful Brand Guideline v2,
 * Phase B1 — foundation). Base list is Prompt 5's `BadgeType` union
 * (`docs/PROMPT-EYVRA-COLORFUL-BRAND-GUIDELINE-V2.md`) plus three real statuses that prompt's own
 * type list predates: `APPLIED`/`REJECTED`/`ROLLED_BACK`.
 *
 * `REJECTED` is a real `LearningProposalDto.status` value (`LearningMonitorClient.tsx`).
 * `ROLLED_BACK` is a real `SimulationStatus` value (AAOS-GO-LIVE, `simulation-record.ts`).
 * `APPLIED` has no real status string anywhere in this repo (`APPLIED` never appears as a status
 * literal in either app) — kept here only because Prompt 16 ("HALAMAN AI IMPROVE") of the same
 * spec doc explicitly colors an `APPLIED` entry in its "Improvement history list", so a later
 * phase wiring that page needs the type to exist even though no backend enum defines it yet.
 */
export type BadgeType =
  | "HOT"
  | "WARM"
  | "COLD"
  | "LIVE"
  | "PAUSED"
  | "LEARNING"
  | "EXECUTED"
  | "SIMULATED"
  | "ERROR"
  | "RUNNING"
  | "HANDOFF"
  | "PROSES"
  | "RECYCLING"
  | "FINAL"
  | "IMPROVING"
  | "STABLE"
  | "ALERT"
  | "APPLIED"
  | "REJECTED"
  | "ROLLED_BACK";

export type BadgeSize = "xs" | "sm" | "md";

export interface BadgeProps {
  readonly type: BadgeType;
  readonly size?: BadgeSize;
}

/**
 * Solid-colored badge config, exact hex values from Prompt 5's `BADGE_CONFIG` table (the more
 * complete, later-in-the-doc, more-refined of the spec's two overlapping badge color tables —
 * the earlier "STATUS BADGES — SOLID COLORED" section is superseded by this one wherever they
 * disagree, e.g. `PAUSED`/`EXECUTED`/`SIMULATED`/`RUNNING` use a light-bg/dark-text pairing here
 * instead of that section's plain solid pairing).
 *
 * `APPLIED`/`REJECTED`/`ROLLED_BACK` are not in Prompt 5's table at all — their colors instead
 * come from Prompt 16's own "Improvement history list" color spec (same doc), which happens to
 * define exactly these three. `REJECTED`'s `#FEE2E2`/`#991B1B` pairing cross-checks exactly
 * against this repo's own real precedent — `LearningMonitorClient.module.css`'s `.statusRejected`
 * already uses `#fee2e2`/`#991b1b` for the same real `REJECTED` proposal status.
 */
const BADGE_CONFIG: Readonly<
  Record<BadgeType, { readonly bg: string; readonly color: string; readonly label: string }>
> = {
  HOT: { bg: "#EF4444", color: "#FFFFFF", label: "HOT" },
  WARM: { bg: "#F59E0B", color: "#FFFFFF", label: "WARM" },
  COLD: { bg: "#64748B", color: "#FFFFFF", label: "COLD" },
  LIVE: { bg: "#10B981", color: "#FFFFFF", label: "Live" },
  PAUSED: { bg: "#CBD5E1", color: "#64748B", label: "Paused" },
  LEARNING: { bg: "#6366F1", color: "#FFFFFF", label: "Learning" },
  EXECUTED: { bg: "#D1FAE5", color: "#065F46", label: "Executed" },
  SIMULATED: { bg: "#E0E7FF", color: "#4338CA", label: "Simulated" },
  ERROR: { bg: "#FEE2E2", color: "#991B1B", label: "Error" },
  RUNNING: { bg: "#FEF3C7", color: "#92400E", label: "Running" },
  HANDOFF: { bg: "#1E6FD9", color: "#FFFFFF", label: "Handoff" },
  PROSES: { bg: "#F59E0B", color: "#FFFFFF", label: "Proses" },
  RECYCLING: { bg: "#8B5CF6", color: "#FFFFFF", label: "Recycle" },
  FINAL: { bg: "#64748B", color: "#FFFFFF", label: "Final" },
  IMPROVING: { bg: "#E0E7FF", color: "#4338CA", label: "Improving" },
  STABLE: { bg: "#D1FAE5", color: "#065F46", label: "Stable" },
  ALERT: { bg: "#FEE2E2", color: "#991B1B", label: "Alert" },
  // Prompt 16's "Improvement history list" colors (not in Prompt 5's BADGE_CONFIG table).
  APPLIED: { bg: "#D1FAE5", color: "#065F46", label: "Applied" },
  REJECTED: { bg: "#FEE2E2", color: "#991B1B", label: "Rejected" },
  ROLLED_BACK: { bg: "#FEF3C7", color: "#92400E", label: "Rolled Back" },
};

const SIZE_CLASS: Readonly<Record<BadgeSize, keyof typeof styles>> = {
  xs: "xs",
  sm: "sm",
  md: "md",
};

/**
 * Unified solid-colored status badge (AAOS Colorful Brand Guideline v2, Prompt 5). Renders inline
 * colors from `BADGE_CONFIG` above rather than CSS-module color classes, since the whole point of
 * this component is one shared source of truth for every status color across the dashboard — a
 * per-type CSS class per color would just duplicate `BADGE_CONFIG` a second time. Size is the only
 * thing driven by a CSS Module class.
 *
 * Not wired into any other component yet — Phase B1 (foundation) only creates and tests it; later
 * phases (B2-B4) replace existing inline status text/dots with this.
 */
export function Badge({ type, size = "sm" }: BadgeProps): React.ReactElement {
  const config = BADGE_CONFIG[type];
  return (
    <span
      data-testid="badge"
      data-type={type}
      data-size={size}
      className={`${styles.badge} ${styles[SIZE_CLASS[size]]}`}
      style={{ background: config.bg, color: config.color }}
    >
      {config.label}
    </span>
  );
}

export default Badge;
