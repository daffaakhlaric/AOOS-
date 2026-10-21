import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import {
  MODE_LABELS,
  SCORE_BUCKET_LABELS,
  STATUS_LABELS,
  type StressTestEvaluatedResultDto,
  type StressTestPartialResultDto,
  type StressTestRunDto,
} from "@/lib/stress-test";
import { isInProgressStatus, progressOf, summarizeProgress } from "@/lib/stress-test-progress";
import { RunProgressChecklist } from "../history/RunProgressChecklist";
import { SCORE_BUCKET_TONE, formatRunDuration } from "@/lib/stress-test-result";
import { ToneBadge } from "./EvidenceBadge";
import styles from "./result.module.css";

function RunMeta({ run }: { readonly run: StressTestRunDto }): React.ReactElement {
  return (
    <div className={styles.heroMeta}>
      <div>
        <span>Status</span>
        <strong data-testid="stress-test-detail-status">{STATUS_LABELS[run.status]}</strong>
      </div>
      <div>
        <span>Mode</span>
        <strong>{MODE_LABELS[run.mode]}</strong>
      </div>
      <div>
        <span>Dibuat</span>
        <strong>{new Date(run.createdAt).toLocaleString("id-ID")}</strong>
      </div>
      <div>
        <span>Waktu proses</span>
        <strong data-testid="stress-test-run-duration">
          {formatRunDuration(run.createdAt, run.completedAt) ?? "—"}
        </strong>
      </div>
    </div>
  );
}

/** Result hero for a run with a real evaluated result: Creative Readiness Score (backend
 * `overallScore` + `scoreBucket`, verbatim) and Confidence shown separately. */
export function ResultHero({
  run,
  result,
}: {
  readonly run: StressTestRunDto;
  readonly result: StressTestEvaluatedResultDto;
}): React.ReactElement {
  const confidence = Math.max(0, Math.min(100, result.confidence));
  return (
    <Card title="Hasil Uji Ketahanan" testId="stress-test-scoring-card" variant="hero">
      <RunMeta run={run} />
      <div className={styles.heroGrid}>
        <div>
          <span className={styles.sectionLabel}>Creative Readiness Score</span>
          {result.overallScore !== null ? (
            <div className={styles.scoreBig}>
              <strong data-testid="stress-test-overall-score">{result.overallScore}</strong>
              <small>/100</small>
              {result.scoreBucket !== null ? (
                <ToneBadge
                  tone={SCORE_BUCKET_TONE[result.scoreBucket]}
                  testId="stress-test-score-bucket"
                >
                  {SCORE_BUCKET_LABELS[result.scoreBucket]}
                </ToneBadge>
              ) : null}
            </div>
          ) : (
            <p data-testid="stress-test-overall-score">— (tidak ada skor nyata pada run ini)</p>
          )}
          <p className={styles.note}>
            Menilai kesiapan creative dari evaluasi copy AI dan simulasi persona — bukan prediksi
            performa, CTR, atau CPL.
          </p>
        </div>
        <div>
          <span className={styles.sectionLabel}>Confidence</span>
          <strong data-testid="stress-test-confidence">{result.confidence}%</strong>
          <div
            className={styles.bar}
            role="meter"
            aria-label="Confidence"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={confidence}
            style={{ marginTop: 6 }}
          >
            <div className={styles.barFill} style={{ width: `${String(confidence)}%` }} />
          </div>
          <p className={styles.note}>
            {result.evaluatorsSucceeded}/{result.evaluatorsAttempted} panggilan evaluator berhasil
            (simulasi persona + copy evaluator
            {result.objectionResolution !== undefined &&
            result.objectionResolution.status !== "SKIPPED"
              ? " + objection resolution"
              : ""}
            )
            {result.factCheck.status === "NOT_APPLICABLE"
              ? "; dikurangi karena fakta belum dapat divalidasi terhadap Listing Knowledge."
              : "."}{" "}
            Confidence mengukur kelengkapan evaluasi, bukan akurasi prediksi.
          </p>
          {result.confidence < 100 ? (
            <div className={styles.confidenceNote} data-testid="stress-test-reduced-confidence">
              <strong>Confidence {result.confidence}%</strong> — sebagian evaluator tidak berhasil
              atau fakta tidak dapat divalidasi. Lihat catatan di bawah.
            </div>
          ) : null}
        </div>
      </div>
      {result.gaps.length > 0 ? (
        <div className={styles.gapList} data-testid="stress-test-gaps">
          <span className={styles.sectionLabel}>Catatan jujur — apa yang tidak berjalan</span>
          <ul className={styles.plainList}>
            {result.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

/** Non-evaluated states (legacy WAITING_FOR_ENGINE, FAILED, DRAFT/QUEUED/RUNNING without result). */
export function RunStateCard({ run }: { readonly run: StressTestRunDto }): React.ReactElement {
  const progress = progressOf(run);
  const summary = progress !== undefined ? summarizeProgress(progress) : undefined;
  return (
    <Card title="Hasil Evaluasi" testId="stress-test-detail-result-card">
      <RunMeta run={run} />
      {run.status === "FAILED" ? (
        <>
          <ErrorState
            message={run.failedReason ?? "Semua evaluator gagal dijalankan pada run ini."}
          />
          {summary !== undefined ? (
            <RunProgressChecklist summary={summary} testId="stress-test-detail-progress" />
          ) : null}
        </>
      ) : isInProgressStatus(run.status) ? (
        <div className={styles.stateBox} data-testid="stress-test-in-progress">
          <p>
            <strong>Sedang dievaluasi</strong> — halaman ini diperbarui otomatis.
          </p>
          {summary !== undefined ? (
            <RunProgressChecklist summary={summary} testId="stress-test-detail-progress" />
          ) : null}
        </div>
      ) : run.result?.kind === "WAITING_FOR_ENGINE" ? (
        <div className={styles.stateBox} data-testid="stress-test-waiting-for-engine">
          <p>
            <strong>Run lama dari sebelum evaluator engine dibangun.</strong>
          </p>
          <p>{run.result.reason}</p>
        </div>
      ) : (
        <EmptyState
          title="Evaluasi belum tersedia"
          description="Run belum dieksekusi, atau masih berjalan — muat ulang halaman ini beberapa saat lagi."
        />
      )}
    </Card>
  );
}

/**
 * FAILED run with real partial output: an explicit "Hasil parsial — run gagal" banner, the real
 * failure reason, the persisted step checklist, and which sections are honestly missing. Never a
 * readiness bucket, score or confidence (the partial result carries none).
 */
export function PartialResultBanner({
  run,
  partial,
}: {
  readonly run: StressTestRunDto;
  readonly partial: StressTestPartialResultDto;
}): React.ReactElement {
  const summary = summarizeProgress(partial.progress);
  const personaOk = partial.personaCritiques.filter((p) => p.ok).length;
  const missing: string[] = [];
  if (personaOk === 0)
    missing.push("Simulasi persona — tidak ada persona yang berhasil disimulasikan.");
  if (partial.copyEvaluation?.ok !== true)
    missing.push("Copy Evaluator — gagal atau tidak selesai.");
  if (partial.factCheck?.status !== "CHECKED") {
    missing.push(
      partial.factCheck?.status === "NOT_APPLICABLE"
        ? `Fact / Claim Validator — ${partial.factCheck.note}`
        : "Fact / Claim Validator — gagal atau tidak selesai.",
    );
  }
  if (partial.objectionResolution?.status !== "ASSESSED") {
    missing.push("Objection Resolution — belum dinilai pada run ini.");
  }
  missing.push(
    "Creative Readiness Score, readiness dan confidence — tidak dihitung dari hasil yang tidak lengkap.",
  );
  return (
    <Card title="Hasil parsial — run gagal" testId="stress-test-partial-banner">
      <RunMeta run={run} />
      <ErrorState message={run.failedReason ?? "Run gagal sebelum semua evaluator selesai."} />
      <p className={styles.note}>
        Hanya bagian yang benar-benar dihasilkan evaluator sebelum run gagal yang ditampilkan di
        bawah ({partial.evaluatorsSucceeded}/{partial.evaluatorsAttempted} panggilan evaluator
        berhasil). Tidak ada skor readiness untuk hasil parsial.
      </p>
      <RunProgressChecklist summary={summary} testId="stress-test-detail-progress" />
      <div className={styles.gapList} data-testid="stress-test-partial-missing">
        <span className={styles.sectionLabel}>Tidak tersedia pada hasil parsial ini</span>
        <ul className={styles.plainList}>
          {missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
      {partial.gaps.length > 0 ? (
        <div className={styles.gapList} data-testid="stress-test-gaps">
          <span className={styles.sectionLabel}>Catatan jujur — apa yang tidak berjalan</span>
          <ul className={styles.plainList}>
            {partial.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
