"use client";

import { useCallback, useEffect, useState } from "react";

import { TopBar } from "@/components/layout/TopBar";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { LearningProposalDto, PromptOverrideDto } from "@/types/learning.types";

import styles from "./LearningMonitorClient.module.css";

const STATUS_OPTIONS = ["PENDING", "APPROVED", "REJECTED"] as const;

function statusBadgeClass(status: string): string {
  if (status === "APPROVED") {
    return styles.statusApproved ?? "";
  }
  if (status === "REJECTED") {
    return styles.statusRejected ?? "";
  }
  return styles.statusPending ?? "";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("id-ID");
}

/**
 * `/learning` — real Learning Monitor page (AAOS Self-Learning AI, Phase C — the human-approval
 * gate). Lists real `learning_proposals` rows (`GET /api/learning/proposals`, optionally filtered
 * by status) with each real gap summary, the real LLM analysis, and the real proposed before/after
 * diff per improvement — Approve/Reject buttons (with an optional notes field) call the real
 * `POST /api/learning/proposals/:id/approve|reject` proxy routes. A real active-overrides table
 * (`GET /api/learning/prompt-overrides`) shows what's currently live per agent/prompt, each with a
 * real manual "Rollback" action (`POST /api/learning/prompt-overrides/:agent/:promptKey/rollback`)
 * — never an automatic score-triggered one (design doc Finding #6).
 *
 * List/filter + refresh-after-action convention mirrors `ActivityLogClient.tsx` (this session's
 * own recent "list of AI-driven records" precedent) — no realtime subscription here (unlike that
 * page): `learning_proposals`/`agent_prompt_overrides` have no dashboard-facing realtime channel
 * wired up in this effort, so this page re-fetches after every Approve/Reject/Rollback action
 * instead, which is real and sufficient for a low-frequency manager review workflow.
 */
export function LearningMonitorClient(): React.ReactElement {
  const [proposals, setProposals] = useState<readonly LearningProposalDto[] | undefined>(undefined);
  const [overrides, setOverrides] = useState<readonly PromptOverrideDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [expandedId, setExpandedId] = useState<string | undefined>(undefined);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | undefined>(undefined);
  const [actionError, setActionError] = useState<string | undefined>(undefined);

  const loadProposals = useCallback(() => {
    const qs = statusFilter.length > 0 ? `?status=${encodeURIComponent(statusFilter)}` : "";
    fetch(`/api/learning/proposals${qs}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat learning proposals.");
        }
        return (await res.json()) as readonly LearningProposalDto[];
      })
      .then(setProposals)
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat learning proposals.");
      });
  }, [statusFilter]);

  const loadOverrides = useCallback(() => {
    fetch("/api/learning/prompt-overrides")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat active overrides.");
        }
        return (await res.json()) as readonly PromptOverrideDto[];
      })
      .then(setOverrides)
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat active overrides.");
      });
  }, []);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  useEffect(() => {
    loadOverrides();
  }, [loadOverrides]);

  async function handleDecide(id: string, action: "approve" | "reject"): Promise<void> {
    setBusyId(id);
    setActionError(undefined);
    try {
      const res = await fetch(`/api/learning/proposals/${encodeURIComponent(id)}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decisionNotes: notesById[id] }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? `Gagal ${action} proposal.`);
      }
      loadProposals();
      loadOverrides();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : `Gagal ${action} proposal.`);
    } finally {
      setBusyId(undefined);
    }
  }

  async function handleRollback(agent: string, promptKey: string): Promise<void> {
    const key = `${agent}:${promptKey}`;
    setBusyId(key);
    setActionError(undefined);
    try {
      const res = await fetch(
        `/api/learning/prompt-overrides/${encodeURIComponent(agent)}/${encodeURIComponent(promptKey)}/rollback`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal rollback.");
      }
      loadOverrides();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Gagal rollback.");
    } finally {
      setBusyId(undefined);
    }
  }

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (proposals === undefined || overrides === undefined) {
    return <LoadingSpinner />;
  }

  return (
    <main>
      <TopBar title="Learning Monitor" />
      <div className={styles.page}>
        {actionError !== undefined ? <p className={styles.errorText}>{actionError}</p> : null}

        <div className={styles.section}>
          <div className={styles.toolbar}>
            <span className={styles.sectionTitle}>Improvement Proposals</span>
            <select
              className={styles.filterSelect}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Semua Status</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {proposals.length === 0 ? (
            <p className={styles.emptyState}>Belum ada learning proposal untuk status ini.</p>
          ) : (
            <div className={styles.list}>
              {proposals.map((proposal) => {
                const expanded = expandedId === proposal.id;
                const busy = busyId === proposal.id;
                return (
                  <div key={proposal.id} className={styles.card}>
                    <button
                      type="button"
                      className={styles.cardHeader}
                      onClick={() => setExpandedId(expanded ? undefined : proposal.id)}
                      aria-expanded={expanded}
                    >
                      <span className={styles.cardHeaderLeft}>
                        <span className={styles.agentBadge}>{proposal.agent}</span>
                        <span className={styles.cardTitle}>
                          {proposal.gaps.verdict ?? "Gap terdeteksi"} —{" "}
                          {proposal.improvements.length} improvement(s)
                        </span>
                      </span>
                      <span className={styles.cardHeaderLeft}>
                        <span className={styles.cardTime}>{formatDate(proposal.createdAt)}</span>
                        <span
                          className={`${styles.statusBadge} ${statusBadgeClass(proposal.status)}`}
                        >
                          {proposal.status}
                        </span>
                      </span>
                    </button>

                    <div className={styles.gapSummary}>
                      {proposal.gaps.overallScore !== undefined ? (
                        <span>Overall: {proposal.gaps.overallScore}</span>
                      ) : null}
                      {proposal.gaps.samanthaCoverageScore !== undefined ? (
                        <span>Samantha: {proposal.gaps.samanthaCoverageScore}</span>
                      ) : null}
                      {proposal.gaps.claraScore !== undefined ? (
                        <span>Clara: {proposal.gaps.claraScore}</span>
                      ) : null}
                      {proposal.gaps.grade !== undefined ? (
                        <span>Grade: {proposal.gaps.grade}</span>
                      ) : null}
                    </div>

                    {expanded ? (
                      <div className={styles.detail}>
                        {proposal.analysis !== null ? (
                          <p className={styles.analysis}>{proposal.analysis}</p>
                        ) : null}

                        {proposal.improvements.map((improvement, index) => (
                          <div
                            key={`${proposal.id}-${String(index)}`}
                            className={styles.improvement}
                          >
                            <div className={styles.improvementHeader}>
                              <span>{improvement.agent}</span>
                              <span>{improvement.type}</span>
                              <span>target: {improvement.target}</span>
                              <span>severity: {improvement.severity}</span>
                            </div>
                            <div className={`${styles.diffBlock} ${styles.diffBefore}`}>
                              − {improvement.before}
                            </div>
                            <div className={`${styles.diffBlock} ${styles.diffAfter}`}>
                              + {improvement.after}
                            </div>
                            <p className={styles.reason}>{improvement.reason}</p>
                          </div>
                        ))}

                        {proposal.status === "PENDING" ? (
                          <div className={styles.actions}>
                            <input
                              type="text"
                              placeholder="Catatan keputusan (opsional)"
                              className={styles.notesInput}
                              value={notesById[proposal.id] ?? ""}
                              onChange={(e) =>
                                setNotesById((prev) => ({ ...prev, [proposal.id]: e.target.value }))
                              }
                            />
                            <button
                              type="button"
                              className={styles.approveButton}
                              disabled={busy}
                              onClick={() => void handleDecide(proposal.id, "approve")}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className={styles.rejectButton}
                              disabled={busy}
                              onClick={() => void handleDecide(proposal.id, "reject")}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <p className={styles.decidedInfo}>
                            {proposal.status} oleh {proposal.decidedBy ?? "(tidak diketahui)"} pada{" "}
                            {proposal.decidedAt !== null ? formatDate(proposal.decidedAt) : "-"}
                            {proposal.decisionNotes !== null
                              ? ` — "${proposal.decisionNotes}"`
                              : ""}
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.section}>
          <span className={styles.sectionTitle}>Active Overrides</span>
          {overrides.length === 0 ? (
            <p className={styles.emptyState}>
              Belum ada active override — semua agent masih memakai prompt default.
            </p>
          ) : (
            <table className={styles.overrideTable}>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Prompt Key</th>
                  <th>Version</th>
                  <th>Activated</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((row) => {
                  const key = `${row.agent}:${row.promptKey}`;
                  return (
                    <tr key={row.id}>
                      <td>{row.agent}</td>
                      <td>{row.promptKey}</td>
                      <td>v{row.version}</td>
                      <td>{row.activatedAt !== null ? formatDate(row.activatedAt) : "-"}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.rollbackButton}
                          disabled={busyId === key}
                          onClick={() => void handleRollback(row.agent, row.promptKey)}
                        >
                          Rollback
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
