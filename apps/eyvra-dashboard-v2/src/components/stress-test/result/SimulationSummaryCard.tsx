import { Card } from "@/components/common/Card";
import {
  MODE_LABELS,
  PRIMARY_GOAL_LABELS,
  type StressTestEvaluatedResultDto,
  type StressTestRunDto,
} from "@/lib/stress-test";
import {
  aggregateObjections,
  computeDataCoverage,
  computeEvaluatorCoverage,
  succeededPersonas,
  type DataCoverageState,
  type EvaluatorState,
} from "@/lib/stress-test-result";
import styles from "./result.module.css";

const EVALUATOR_STATE_TEXT: Record<EvaluatorState, string> = {
  SUCCEEDED: "✓ Berhasil",
  PARTIAL: "◐ Sebagian",
  FAILED: "✗ Gagal",
  NOT_RUN: "— Tidak dijalankan",
  NOT_AVAILABLE: "Belum tersedia",
};

const DATA_STATE_TEXT: Record<DataCoverageState, string> = {
  AVAILABLE: "✓",
  MISSING: "✗",
  NOT_CONNECTED: "Belum terhubung",
};

/** Right rail "Ringkasan Simulasi" — counts and coverage computed from the real result only. */
export function SimulationSummaryCard({
  run,
  result,
  listingLoaded,
  creativeResolved,
}: {
  readonly run: StressTestRunDto;
  readonly result: StressTestEvaluatedResultDto;
  readonly listingLoaded: boolean;
  readonly creativeResolved: boolean;
}): React.ReactElement {
  const agg = aggregateObjections(result);
  const evaluators = computeEvaluatorCoverage(result);
  const data = computeDataCoverage({ listingLoaded, creativeResolved, result });
  return (
    <Card title="Ringkasan Simulasi" variant="compact" testId="stress-test-summary-card">
      <ul className={styles.railList}>
        <li>
          <span>Mode</span>
          <strong>{MODE_LABELS[run.mode]}</strong>
        </li>
        <li>
          <span>Primary goal</span>
          <strong>{PRIMARY_GOAL_LABELS[run.primaryGoal]}</strong>
        </li>
        <li>
          <span>Persona diuji</span>
          <strong data-testid="stress-test-summary-personas">
            {succeededPersonas(result).length}/{result.personaCritiques.length} berhasil
          </strong>
        </li>
        <li>
          <span>Total keberatan</span>
          <strong>{agg.totalObjections}</strong>
        </li>
        <li>
          <span>Keberatan unik</span>
          <strong>{agg.uniqueObjections}</strong>
        </li>
        <li>
          <span>Confidence</span>
          <strong>{result.confidence}%</strong>
        </li>
      </ul>

      <div className={styles.railSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className={styles.sectionLabel}>Evaluator Coverage</span>
          <strong data-testid="stress-test-evaluator-coverage">
            {evaluators.succeeded}/{evaluators.attempted}
          </strong>
        </div>
        <ul className={styles.railList} data-testid="stress-test-evaluator-rows">
          {evaluators.rows.map((row) => (
            <li key={row.label} title={row.note}>
              <span>{row.label}</span>
              <span>{EVALUATOR_STATE_TEXT[row.state]}</span>
            </li>
          ))}
        </ul>
        <p className={styles.note}>
          Hanya evaluator yang benar-benar dijalankan dihitung. Evaluator &ldquo;Belum
          tersedia&rdquo; belum dibangun — bukan gagal.
        </p>
      </div>

      <div className={styles.railSection}>
        <span className={styles.sectionLabel}>Data Coverage</span>
        <ul className={styles.railList} data-testid="stress-test-data-coverage">
          {data.map((row) => (
            <li key={row.label}>
              <span>{row.label}</span>
              <span>{DATA_STATE_TEXT[row.state]}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
