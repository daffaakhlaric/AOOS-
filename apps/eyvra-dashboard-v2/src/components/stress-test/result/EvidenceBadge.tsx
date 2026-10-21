import {
  EVIDENCE_DESCRIPTIONS,
  EVIDENCE_LABELS,
  type EvidenceKind,
  type Tone,
} from "@/lib/stress-test-result";
import styles from "./result.module.css";

/** Source-of-evidence marker (SIMULATED / KNOWLEDGE / LISTING DATA / UNVERIFIED). There is no
 * LIVE DATA variant on purpose — no live performance data backs a stress-test result. */
export function EvidenceBadge({ kind }: { readonly kind: EvidenceKind }): React.ReactElement {
  return (
    <span
      className={`${styles.evidence} ${styles[`evidence_${kind}`] ?? ""}`}
      title={EVIDENCE_DESCRIPTIONS[kind]}
      data-testid={`evidence-badge-${kind}`}
    >
      {EVIDENCE_LABELS[kind]}
    </span>
  );
}

export function ToneBadge({
  tone,
  children,
  testId,
}: {
  readonly tone: Tone;
  readonly children: React.ReactNode;
  readonly testId?: string;
}): React.ReactElement {
  return (
    <span className={`${styles.badge} ${styles[`tone_${tone}`] ?? ""}`} data-testid={testId}>
      {children}
    </span>
  );
}
