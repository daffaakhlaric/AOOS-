"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SimulationRunListItem } from "@/lib/stress-test-history";
import {
  SimulationConfidenceCell,
  SimulationReadinessBadge,
  SimulationScoreCell,
} from "./SimulationCells";
import { RunProgressChecklist } from "./RunProgressChecklist";
import { SimulationPersonaStack } from "./SimulationPersonaStack";
import { SimulationRunActions } from "./SimulationRunActions";
import styles from "./history.module.css";

const Dash = (): React.ReactElement => <span className={styles.dash}>—</span>;

function isInteractive(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("a, button, input, select, textarea, [role='menu']") !== null
  );
}

function ContextCell({ item }: { readonly item: SimulationRunListItem }): React.ReactElement {
  return (
    <div className={styles.context}>
      {item.contextThumbnailUrl !== undefined ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote listing photo, same as other thumbnails
        <img src={item.contextThumbnailUrl} alt="" className={styles.thumb} loading="lazy" />
      ) : (
        <span className={`${styles.thumb} ${styles.thumbPlaceholder}`} aria-hidden="true">
          —
        </span>
      )}
      <div>
        <span className={styles.contextTitle} data-testid="run-context-title">
          {item.contextTitle ?? (item.contextLoading ? "Memuat…" : "—")}
        </span>
        <span className={styles.typeBadge}>{item.sourceTypeLabel.toUpperCase()}</span>
      </div>
    </div>
  );
}

function CreativeCell({ item }: { readonly item: SimulationRunListItem }): React.ReactElement {
  const c = item.creative;
  if (c.kind === "NONE") return <span className={styles.dash}>Tanpa creative spesifik</span>;
  if (c.kind === "UNRESOLVED") {
    return (
      <span title="Creative dipilih, tetapi metadatanya tidak dimuat di daftar ini">
        <Dash />
        <span className={styles.sub}>{c.selected} dipilih</span>
      </span>
    );
  }
  return (
    <span className={styles.context} style={{ minWidth: 0 }}>
      {c.thumbnailUrl !== undefined ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote listing photo
        <img src={c.thumbnailUrl} alt="" className={styles.thumb} loading="lazy" />
      ) : null}
      <span>
        {c.resolved} creative
        {c.resolved < c.selected ? (
          <span className={styles.sub}>dari {c.selected} dipilih</span>
        ) : null}
      </span>
    </span>
  );
}

function StatusCell({ item }: { readonly item: SimulationRunListItem }): React.ReactElement {
  return (
    <div className={styles.statusCell} data-testid="run-status">
      <span>{item.statusLabel}</span>
      {item.inProgress && item.progress !== undefined ? (
        <RunProgressChecklist summary={item.progress} />
      ) : null}
      {item.inProgress && item.progress === undefined ? (
        <span className={styles.sub}>
          <span className={styles.spinner} aria-hidden="true" />
          Sedang dievaluasi
        </span>
      ) : null}
      {item.failed ? (
        <span className={styles.failReason} title={item.failureReason}>
          {item.failureReason ?? "Alasan tidak tercatat"}
        </span>
      ) : null}
    </div>
  );
}

export function SimulationRunsTable({
  rows,
  onCompare,
}: {
  readonly rows: readonly SimulationRunListItem[];
  readonly onCompare: (runId: string) => void;
}): React.ReactElement {
  const router = useRouter();
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table} data-testid="simulation-runs-table">
        <thead>
          <tr>
            <th>Run</th>
            <th>Konteks</th>
            <th className={styles.colLow}>Creative</th>
            <th>Mode</th>
            <th className={styles.colLow}>Persona</th>
            <th>Status</th>
            <th>Readiness</th>
            <th>Skor</th>
            <th className={styles.colLow}>Confidence</th>
            <th>Isu Utama</th>
            <th className={styles.colLow}>Keberatan</th>
            <th>Dibuat</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr
              key={item.id}
              className={styles.row}
              role="link"
              tabIndex={0}
              aria-label={`Lihat detail run ${item.name}`}
              data-testid="simulation-run-row"
              onClick={(e) => {
                if (isInteractive(e.target)) return;
                router.push(item.href);
              }}
              onKeyDown={(e) => {
                // Only the row itself — keys on buttons/links inside must not navigate the row.
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(item.href);
                }
              }}
            >
              <td data-label="Run">
                {/* Real link kept for screen readers / middle-click; the row handles the rest. */}
                <Link
                  href={item.href}
                  className={styles.rowLink}
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.name}
                </Link>
                <span className={`${styles.sub} ${styles.mono}`}>#{item.shortId}</span>
              </td>
              <td data-label="Konteks">
                <ContextCell item={item} />
              </td>
              <td data-label="Creative" className={styles.colLow}>
                <CreativeCell item={item} />
              </td>
              <td data-label="Mode">
                <span className={`${styles.badge} ${styles[`mode_${item.mode}`] ?? ""}`}>
                  {item.modeLabel}
                </span>
              </td>
              <td data-label="Persona" className={styles.colLow}>
                <SimulationPersonaStack personas={item.personas} />
              </td>
              <td data-label="Status">
                <StatusCell item={item} />
              </td>
              <td data-label="Readiness">
                <SimulationReadinessBadge item={item} />
              </td>
              <td data-label="Skor">
                <SimulationScoreCell item={item} />
              </td>
              <td data-label="Confidence" className={styles.colLow}>
                <SimulationConfidenceCell item={item} />
              </td>
              <td data-label="Isu Utama">
                {item.topIssue !== undefined ? (
                  <span
                    className={styles.topIssue}
                    title={item.topIssue}
                    data-testid="run-top-issue"
                  >
                    {item.topIssue}
                  </span>
                ) : (
                  <Dash />
                )}
              </td>
              <td data-label="Keberatan" className={styles.colLow}>
                {item.objections !== undefined ? (
                  <Link
                    href={item.objectionsHref}
                    className={styles.objLink}
                    onClick={(e) => e.stopPropagation()}
                    data-testid="run-objections"
                    title={
                      item.objections.resolution !== undefined
                        ? `${String(item.objections.unique)} keberatan unik dari simulasi persona AI — status resolusi adalah estimasi AI (simulasi)`
                        : "Keberatan dari simulasi persona AI"
                    }
                  >
                    {item.objections.resolution !== undefined
                      ? `${String(item.objections.resolution.unresolved)} belum terjawab · ${String(item.objections.resolution.partial)} sebagian`
                      : `${String(item.objections.total)} keberatan · ${String(item.objections.unique)} unik`}
                  </Link>
                ) : (
                  <Dash />
                )}
              </td>
              <td data-label="Dibuat">
                {item.createdLabel ?? "—"}
                {item.relativeLabel !== undefined ? (
                  <span className={styles.sub}>{item.relativeLabel}</span>
                ) : null}
              </td>
              <td data-label="Aksi">
                <SimulationRunActions item={item} onCompare={onCompare} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
