import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import {
  CLAIM_STATUS_LABELS,
  COPY_DIMENSION_STATUS_LABELS,
  type StressTestClaimStatus,
  type StressTestCopyDimensionStatus,
  type StressTestCopyEvaluationResultDto,
  type StressTestFactCheckResultDto,
} from "@/lib/stress-test";
import { COPY_EVALUATOR_DIMENSIONS, evidenceForClaim, type Tone } from "@/lib/stress-test-result";
import { EvidenceBadge, ToneBadge } from "./EvidenceBadge";
import styles from "./result.module.css";

const COPY_TONE: Record<StressTestCopyDimensionStatus, Tone> = {
  STRONG: "success",
  ADEQUATE: "warning",
  WEAK: "critical",
};

const CLAIM_TONE: Record<StressTestClaimStatus, Tone> = {
  SUPPORTED: "success",
  UNSUPPORTED_CLAIM: "warning",
  CONFLICTING_CLAIM: "critical",
};

export function CopyEvaluatorCard({
  evaluation,
}: {
  readonly evaluation: StressTestCopyEvaluationResultDto;
}): React.ReactElement {
  return (
    <Card
      title="Copy Evaluator"
      subtitle="Evaluasi AI atas teks creative (4 dimensi)."
      testId="stress-test-copy-card"
    >
      {!evaluation.ok ? (
        <ErrorState
          message={`Copy Evaluator gagal: ${evaluation.failureReason ?? "alasan tidak diketahui"}`}
        />
      ) : (
        <div data-testid="stress-test-copy-evaluation">
          {evaluation.summary !== undefined ? (
            <p style={{ marginBottom: 10 }}>{evaluation.summary}</p>
          ) : null}
          <div className={styles.copyGrid}>
            {COPY_EVALUATOR_DIMENSIONS.map(({ key, label }) => {
              const dim = evaluation[key];
              return (
                <div key={key} className={styles.copyCard}>
                  <header>
                    <strong>{label}</strong>
                    {dim !== undefined ? (
                      <ToneBadge tone={COPY_TONE[dim.status]}>
                        {COPY_DIMENSION_STATUS_LABELS[dim.status]}
                      </ToneBadge>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </header>
                  <span className={styles.muted}>
                    {dim?.reasoning ?? "Tidak dinilai pada run ini."}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

export function FactValidationPanel({
  factCheck,
}: {
  readonly factCheck: StressTestFactCheckResultDto;
}): React.ReactElement {
  return (
    <Card
      title="Validasi Fakta / Klaim"
      subtitle="Klaim pada creative dicek terhadap Listing Knowledge."
      testId="stress-test-fact-card"
    >
      {factCheck.status !== "CHECKED" ? (
        <EmptyState
          compact
          title={
            factCheck.status === "FAILED" ? "Validasi fakta gagal" : "Belum dapat diverifikasi"
          }
          description={factCheck.note}
        />
      ) : factCheck.findings.length === 0 ? (
        <p>Tidak ada klaim faktual yang terdeteksi pada creative ini.</p>
      ) : (
        <div data-testid="stress-test-fact-check">
          {factCheck.findings.map((finding, i) => (
            <div key={`${finding.claim}-${String(i)}`} className={styles.claimRow}>
              <div className={styles.claimHeader}>
                <strong>{finding.claim}</strong>
                <span className={styles.badgeRow}>
                  <ToneBadge tone={CLAIM_TONE[finding.status]}>
                    {CLAIM_STATUS_LABELS[finding.status]}
                  </ToneBadge>
                  <EvidenceBadge kind={evidenceForClaim(finding)} />
                </span>
              </div>
              <p className={styles.muted}>{finding.reasoning}</p>
              {finding.citationFileName !== undefined ? (
                <small className={styles.muted}>Sumber: {finding.citationFileName}</small>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
