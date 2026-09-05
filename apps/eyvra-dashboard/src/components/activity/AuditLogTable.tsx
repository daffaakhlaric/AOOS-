"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { AuditLogDto } from "@/types/audit-log.types";

import styles from "./AuditLogTable.module.css";

const AGENT_OPTIONS = ["SAMANTHA", "KAI", "CLARA", "KAREN"] as const;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID");
}

function decidedByLabel(entry: AuditLogDto): string {
  if (entry.decidedBy === "ai_auto") {
    return "AI (otomatis)";
  }
  return entry.userId !== undefined ? `User (${entry.userId})` : "User";
}

/** Real, minimal CSV escaping — wraps a field in quotes and doubles any embedded quote whenever it contains a comma, quote, or newline. */
function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(entries: readonly AuditLogDto[]): string {
  const header = ["waktu", "agent", "aksi", "diputuskan_oleh", "mode", "status", "reversible"];
  const rows = entries.map((entry) => [
    formatDateTime(entry.createdAt),
    entry.agent,
    entry.actionType,
    decidedByLabel(entry),
    entry.mode,
    entry.actionType === "ROLLBACK" ? "Rolled back" : "Recorded",
    entry.reversible ? "Ya" : "Tidak",
  ]);
  return [header, ...rows].map((row) => row.map(csvField).join(",")).join("\n");
}

/**
 * "Audit" sub-tab (AAOS LOOP UPGRADE, Sprint 6 Prompt 17) — real table view over `audit_log`, kept
 * as its own component (not folded into `ActivityHubClient`'s feed-card rendering) per the spec's
 * own explicit instruction that this is a table, not a feed. Real data only: no fabricated historical
 * rows, no fake rollback that doesn't actually revert anything (see `AuditLogService.rollback`'s own
 * doc on `apps/aaos-api` for which `action_type`s are honestly `reversible`).
 */
export function AuditLogTable(): React.ReactElement {
  const [entries, setEntries] = useState<readonly AuditLogDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [agentFilter, setAgentFilter] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<AuditLogDto | undefined>(undefined);
  const [rollbackConfirmId, setRollbackConfirmId] = useState<string | undefined>(undefined);
  const [rollbackBusy, setRollbackBusy] = useState(false);
  const [rollbackError, setRollbackError] = useState<string | undefined>(undefined);

  function load(): void {
    const qs = agentFilter !== undefined ? `?agent=${encodeURIComponent(agentFilter)}` : "";
    fetch(`/api/audit-log${qs}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat audit log.");
        }
        return (await res.json()) as { entries: readonly AuditLogDto[] };
      })
      .then((body) => setEntries(body.entries))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat audit log.");
      });
  }

  useEffect(load, [agentFilter]);

  async function confirmRollback(id: string): Promise<void> {
    setRollbackBusy(true);
    setRollbackError(undefined);
    try {
      const res = await fetch(`/api/audit-log/${encodeURIComponent(id)}/rollback`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal melakukan rollback.");
      }
      setRollbackConfirmId(undefined);
      load();
    } catch (caught) {
      setRollbackError(caught instanceof Error ? caught.message : "Gagal melakukan rollback.");
    } finally {
      setRollbackBusy(false);
    }
  }

  function exportCsv(): void {
    if (entries === undefined || entries.length === 0) return;
    const csv = toCsv(entries);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const rollbackTarget = useMemo(
    () => entries?.find((entry) => entry.id === rollbackConfirmId),
    [entries, rollbackConfirmId],
  );

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (entries === undefined) {
    return <LoadingSpinner />;
  }

  return (
    <div className={styles.page} data-testid="audit-log-table">
      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <button
            type="button"
            className={`${styles.filterChip} ${agentFilter === undefined ? styles.filterChipActive : ""}`}
            onClick={() => setAgentFilter(undefined)}
          >
            Semua
          </button>
          {AGENT_OPTIONS.map((agent) => (
            <button
              key={agent}
              type="button"
              className={`${styles.filterChip} ${agentFilter === agent ? styles.filterChipActive : ""}`}
              onClick={() => setAgentFilter(agentFilter === agent ? undefined : agent)}
            >
              {agent}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.exportButton}
          onClick={exportCsv}
          disabled={entries.length === 0}
        >
          📄 Export CSV
        </button>
      </div>

      {entries.length === 0 ? (
        <p className={styles.emptyState}>Belum ada audit log.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Agent</th>
                <th>Aksi</th>
                <th>Diputuskan oleh</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className={styles.row}
                  data-testid={`audit-row-${entry.id}`}
                  onClick={() => setSelected(entry)}
                >
                  <td>{formatDateTime(entry.createdAt)}</td>
                  <td>{entry.agent}</td>
                  <td>{entry.actionType}</td>
                  <td>{decidedByLabel(entry)}</td>
                  <td>{entry.mode}</td>
                  <td>{entry.actionType === "ROLLBACK" ? "Rolled back" : "Recorded"}</td>
                  <td onClick={(event) => event.stopPropagation()}>
                    {entry.reversible ? (
                      <button
                        type="button"
                        className={styles.rollbackButton}
                        data-testid={`rollback-button-${entry.id}`}
                        onClick={() => setRollbackConfirmId(entry.id)}
                      >
                        ↩ Rollback
                      </button>
                    ) : (
                      <span className={styles.mutedText}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected !== undefined ? (
        <div className={styles.diffOverlay} role="dialog" aria-label="Detail audit log">
          <div className={styles.diffPanel}>
            <div className={styles.diffHeader}>
              <h3>
                {selected.agent} — {selected.actionType}
              </h3>
              <button type="button" onClick={() => setSelected(undefined)}>
                ✕
              </button>
            </div>
            <div className={styles.diffGrid}>
              <div>
                <h4>Before</h4>
                <pre className={styles.diffBlock}>
                  {JSON.stringify(selected.beforeState, null, 2) ?? "—"}
                </pre>
              </div>
              <div>
                <h4>After</h4>
                <pre className={styles.diffBlock}>
                  {JSON.stringify(selected.afterState, null, 2) ?? "—"}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {rollbackConfirmId !== undefined ? (
        <div className={styles.diffOverlay} role="dialog" aria-label="Konfirmasi rollback">
          <div className={styles.confirmPanel}>
            <p>
              Rollback aksi <strong>{rollbackTarget?.actionType}</strong> ini? Ini akan menjalankan
              aksi pembalik yang sesungguhnya (mis. pause campaign di Meta).
            </p>
            {rollbackError !== undefined ? <ErrorCard message={rollbackError} /> : null}
            <div className={styles.confirmActions}>
              <button
                type="button"
                onClick={() => setRollbackConfirmId(undefined)}
                disabled={rollbackBusy}
              >
                Batal
              </button>
              <button
                type="button"
                className={styles.rollbackButton}
                onClick={() => void confirmRollback(rollbackConfirmId)}
                disabled={rollbackBusy}
              >
                {rollbackBusy ? "Memproses..." : "Ya, rollback"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AuditLogTable;
