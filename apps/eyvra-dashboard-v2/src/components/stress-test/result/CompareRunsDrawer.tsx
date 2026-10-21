"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { comparisonContext } from "@/lib/simulation-compare";
import { Drawer } from "@/components/common/Drawer";
import { SCORE_BUCKET_LABELS, type StressTestRunDto } from "@/lib/stress-test";
import {
  compareCandidates,
  compareRuns,
  evaluatedResultOf,
  type RunComparisonRow,
} from "@/lib/stress-test-result";
import styles from "./result.module.css";

function Delta({ row }: { readonly row: RunComparisonRow }): React.ReactElement {
  if (row.delta === undefined) return <span className={styles.muted}>—</span>;
  if (row.delta === 0) return <span>0</span>;
  return (
    <span className={row.delta > 0 ? styles.deltaUp : styles.deltaDown}>
      {row.delta > 0 ? "+" : ""}
      {row.delta}
    </span>
  );
}

function Row({
  row,
  higherIsBetter = true,
}: {
  readonly row: RunComparisonRow;
  readonly higherIsBetter?: boolean;
}): React.ReactElement {
  return (
    <tr>
      <td>{row.label}</td>
      <td>{row.current ?? "—"}</td>
      <td>{row.other ?? "—"}</td>
      <td>
        {higherIsBetter ? (
          <Delta row={row} />
        ) : row.delta === undefined ? (
          "—"
        ) : (
          `${row.delta > 0 ? "+" : ""}${String(row.delta)}`
        )}
      </td>
    </tr>
  );
}

/**
 * "Bandingkan Run" — pick another real, evaluated run (runs on the same listing/campaign listed
 * first, newest first) and view real scores side by side. No lineage exists between runs, so no
 * "round" history is implied — only real runs by date.
 */
export function CompareRunsDrawer({
  open,
  onClose,
  current,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly current: StressTestRunDto;
}): React.ReactElement | null {
  const [runs, setRuns] = useState<readonly StressTestRunDto[] | undefined>();
  const [error, setError] = useState(false);
  const [otherId, setOtherId] = useState("");

  useEffect(() => {
    if (!open || runs !== undefined) return;
    const controller = new AbortController();
    setError(false);
    fetch("/api/creative-stress-test", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return (await r.json()) as { runs?: StressTestRunDto[] };
      })
      .then((body) => {
        if (!controller.signal.aborted) setRuns(Array.isArray(body.runs) ? body.runs : []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [open, runs]);

  const candidates = useMemo(
    () => (runs === undefined ? [] : compareCandidates(current, runs)),
    [current, runs],
  );
  const currentResult = evaluatedResultOf(current);
  const other = candidates.find((c) => c.run.id === otherId)?.run;
  const otherResult = other !== undefined ? evaluatedResultOf(other) : undefined;
  const context = other ? comparisonContext(current, other) : undefined;
  const comparison =
    currentResult !== undefined && otherResult !== undefined && !context?.blocked
      ? compareRuns(currentResult, otherResult)
      : undefined;

  return (
    <Drawer open={open} onClose={onClose} title="Bandingkan Run">
      <div data-testid="stress-test-compare-drawer">
        {currentResult === undefined ? (
          <p>Run ini belum memiliki hasil evaluasi untuk dibandingkan.</p>
        ) : error ? (
          <p role="alert">Riwayat run belum dapat dimuat.</p>
        ) : runs === undefined ? (
          <p className={styles.muted}>Memuat riwayat run…</p>
        ) : candidates.length === 0 ? (
          <p>Belum ada run lain dengan hasil evaluasi untuk dibandingkan.</p>
        ) : (
          <>
            <label className={styles.sectionLabel} htmlFor="stress-test-compare-select">
              Bandingkan dengan
            </label>
            <select
              id="stress-test-compare-select"
              className={styles.select}
              value={otherId}
              onChange={(e) => setOtherId(e.target.value)}
              data-testid="stress-test-compare-select"
            >
              <option value="">Pilih run…</option>
              {candidates.map(({ run, sameContext }) => (
                <option key={run.id} value={run.id}>
                  {run.name} — {new Date(run.createdAt).toLocaleDateString("id-ID")}
                  {sameContext ? " (konteks sama)" : ""}
                </option>
              ))}
            </select>
            {context && (
              <p role="status" className={styles.note}>
                {context.warnings.join(" ")}
              </p>
            )}
            <Link
              className={styles.buttonPrimary}
              href={`/samantha/simulation/compare?${new URLSearchParams({ runA: current.id, ...(other ? { runB: other.id } : {}) })}`}
            >
              Buka Compare Runs lengkap →
            </Link>
            {comparison !== undefined && other !== undefined ? (
              <div className={styles.tableWrap}>
                <table className={styles.table} data-testid="stress-test-compare-table">
                  <thead>
                    <tr>
                      <th>Metrik</th>
                      <th>Run ini</th>
                      <th>{other.name}</th>
                      <th>Selisih</th>
                    </tr>
                  </thead>
                  <tbody>
                    <Row row={comparison.overall} />
                    <tr>
                      <td>Status skor</td>
                      <td>
                        {comparison.currentBucket !== null
                          ? SCORE_BUCKET_LABELS[comparison.currentBucket]
                          : "—"}
                      </td>
                      <td>
                        {comparison.otherBucket !== null
                          ? SCORE_BUCKET_LABELS[comparison.otherBucket]
                          : "—"}
                      </td>
                      <td>—</td>
                    </tr>
                    {comparison.dimensions.map((d) => (
                      <Row key={d.label} row={d} />
                    ))}
                    <Row row={comparison.uniqueObjections} higherIsBetter={false} />
                  </tbody>
                </table>
                <p className={styles.note}>
                  Selisih = run ini dikurangi run pembanding. Run tidak saling terhubung — pastikan
                  creative dan persona yang diuji memang sebanding sebelum menarik kesimpulan.
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </Drawer>
  );
}
