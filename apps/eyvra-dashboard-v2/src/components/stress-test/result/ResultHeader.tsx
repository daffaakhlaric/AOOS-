import Link from "next/link";
import { buildRunAgainHref } from "@/lib/stress-test-result";
import styles from "./result.module.css";

/** Page header + the three run-level actions. Run Lagi / Duplicate are plain navigations to the
 * existing builder with the run's real settings prefilled (`?fromRun=`); nothing is created until
 * the user presses "Jalankan" there. */
export function ResultHeader({
  runId,
  runName,
  onCompare,
}: {
  readonly runId: string;
  readonly runName?: string;
  readonly onCompare?: () => void;
}): React.ReactElement {
  return (
    <header className={styles.header}>
      <div>
        <Link href="/samantha/stress-test" className={styles.backLink}>
          ← Kembali ke riwayat
        </Link>
        <h1>Detail Run Uji Ketahanan Creative</h1>
        <p>
          {runName ?? "Creative Stress Test"} — hasil evaluasi AI dan simulasi persona sebelum
          creative dijalankan.
        </p>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          onClick={onCompare}
          disabled={onCompare === undefined}
          data-testid="stress-test-compare-button"
        >
          Bandingkan Run
        </button>
        <Link
          href={buildRunAgainHref(runId, "duplicate")}
          className={styles.button}
          data-testid="stress-test-duplicate-link"
        >
          Duplicate Run
        </Link>
        <Link
          href={buildRunAgainHref(runId, "rerun")}
          className={styles.buttonPrimary}
          data-testid="stress-test-run-again-link"
        >
          Run Lagi dengan Pengaturan Ini
        </Link>
      </div>
    </header>
  );
}
