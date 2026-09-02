"use client";

import { useCallback, useEffect, useState } from "react";

import { TopBar } from "@/components/layout/TopBar";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { LearningProposalDto, PromptOverrideDto } from "@/types/learning.types";
import type { PendingActionDto } from "@/types/pending-actions.types";

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
 *
 * AAOS-AI-JUDGE-SELF-IMPROVING, Phase J3 — a real, minimal display-only update: a proposal whose
 * `agentRunId` is populated (vs. `simulationId`) is a real LIVE-run-triggered proposal
 * (`LearningService.onAgentRunJudged`), not a simulation-triggered one. A "LIVE RUN" badge plus the
 * real triggering `agentRunId`/judge score/trend are shown in place of the simulation-shaped gap
 * summary — Approve/Reject/Rollback mechanics below are completely unchanged (design doc Finding
 * #6: no new approval mechanism, ever).
 *
 * AAOS-OPERATING-MODE-APPROVAL-GATE — a genuinely SEPARATE, additional section (real
 * `pending_agent_actions` rows, `GET /api/pending-actions`), not a reuse of the Improvement
 * Proposals mechanics above: this is a different real decision table (Samantha's PROPERTY
 * campaign-creation trigger, gated by a tenant's `operating_mode`), never
 * `learning_proposals`/`agent_prompt_overrides`. Lives on this SAME page (per the design doc's own
 * suggestion) rather than a new page, since both sections are the same real "manager reviews an
 * AI-driven pending action" workflow shape — same list/filter + Approve/Reject + refresh-after-
 * action convention as the section above, no new mechanic invented.
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

  // AAOS-OPERATING-MODE-APPROVAL-GATE — separate real state for the Pending Actions section below.
  const [pendingActions, setPendingActions] = useState<readonly PendingActionDto[] | undefined>(
    undefined,
  );
  const [pendingStatusFilter, setPendingStatusFilter] = useState("PENDING");
  const [pendingNotesById, setPendingNotesById] = useState<Record<string, string>>({});
  const [pendingBusyId, setPendingBusyId] = useState<string | undefined>(undefined);
  const [pendingActionError, setPendingActionError] = useState<string | undefined>(undefined);

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

  const loadPendingActions = useCallback(() => {
    const qs =
      pendingStatusFilter.length > 0 ? `?status=${encodeURIComponent(pendingStatusFilter)}` : "";
    fetch(`/api/pending-actions${qs}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat pending actions.");
        }
        return (await res.json()) as readonly PendingActionDto[];
      })
      .then(setPendingActions)
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat pending actions.");
      });
  }, [pendingStatusFilter]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  useEffect(() => {
    loadOverrides();
  }, [loadOverrides]);

  useEffect(() => {
    loadPendingActions();
  }, [loadPendingActions]);

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

  /** AAOS-OPERATING-MODE-APPROVAL-GATE — mirrors `handleDecide` above exactly, against `/api/pending-actions/:id/*` instead of `/api/learning/proposals/:id/*`. */
  async function handleDecidePendingAction(
    id: string,
    action: "approve" | "reject",
  ): Promise<void> {
    setPendingBusyId(id);
    setPendingActionError(undefined);
    try {
      const res = await fetch(`/api/pending-actions/${encodeURIComponent(id)}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decisionNotes: pendingNotesById[id] }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? `Gagal ${action} pending action.`);
      }
      loadPendingActions();
    } catch (caught) {
      setPendingActionError(
        caught instanceof Error ? caught.message : `Gagal ${action} pending action.`,
      );
    } finally {
      setPendingBusyId(undefined);
    }
  }

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (proposals === undefined || overrides === undefined || pendingActions === undefined) {
    return <LoadingSpinner />;
  }

  return (
    <main>
      <TopBar title="Learning Monitor" accentColor="var(--v2-menu-improve)" />
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
                        {proposal.agentRunId !== null ? (
                          <span className={styles.statusBadge}>LIVE RUN</span>
                        ) : null}
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
                      {proposal.agentRunId !== null ? (
                        // AAOS-AI-JUDGE-SELF-IMPROVING, Phase J3 — a real LIVE-run-triggered
                        // proposal has no `simulations` link to show; surface the real triggering
                        // context instead (the judged agent run + the real judge score that crossed
                        // `LearningService`'s LIVE_RUN_GAP_THRESHOLD).
                        <>
                          <span>Agent Run: {proposal.agentRunId}</span>
                          {proposal.gaps.overallScore !== undefined ? (
                            <span>Judge Score: {proposal.gaps.overallScore}</span>
                          ) : null}
                          {proposal.gaps.trend !== undefined ? (
                            <span>Trend: {proposal.gaps.trend}</span>
                          ) : null}
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
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

        <div className={styles.section} data-testid="pending-actions-section">
          <div className={styles.toolbar}>
            <span className={styles.sectionTitle}>Pending Actions (Mode Operasi AI)</span>
            <select
              className={styles.filterSelect}
              value={pendingStatusFilter}
              onChange={(e) => setPendingStatusFilter(e.target.value)}
            >
              <option value="">Semua Status</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {pendingActionError !== undefined ? (
            <p className={styles.errorText}>{pendingActionError}</p>
          ) : null}

          {pendingActions.length === 0 ? (
            <p className={styles.emptyState}>
              Belum ada pending action untuk status ini — tenant dalam mode Approval akan
              menampilkan trigger campaign otomatis Samantha di sini menunggu persetujuan.
            </p>
          ) : (
            <div className={styles.list}>
              {pendingActions.map((action) => {
                const busy = pendingBusyId === action.id;
                const listingId =
                  typeof action.payload["listingId"] === "string"
                    ? action.payload["listingId"]
                    : undefined;
                return (
                  <div key={action.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardHeaderLeft}>
                        <span className={styles.agentBadge}>{action.agent}</span>
                        <span className={styles.cardTitle}>
                          {action.actionType}
                          {listingId !== undefined ? ` — listing ${listingId}` : ""}
                        </span>
                      </span>
                      <span className={styles.cardHeaderLeft}>
                        <span className={styles.cardTime}>{formatDate(action.createdAt)}</span>
                        <span
                          className={`${styles.statusBadge} ${statusBadgeClass(action.status)}`}
                        >
                          {action.status}
                        </span>
                      </span>
                    </div>

                    <div className={styles.detail}>
                      {action.status === "PENDING" ? (
                        <div className={styles.actions}>
                          <input
                            type="text"
                            placeholder="Catatan keputusan (opsional)"
                            className={styles.notesInput}
                            value={pendingNotesById[action.id] ?? ""}
                            onChange={(e) =>
                              setPendingNotesById((prev) => ({
                                ...prev,
                                [action.id]: e.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className={styles.approveButton}
                            disabled={busy}
                            onClick={() => void handleDecidePendingAction(action.id, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className={styles.rejectButton}
                            disabled={busy}
                            onClick={() => void handleDecidePendingAction(action.id, "reject")}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <p className={styles.decidedInfo}>
                          {action.status} oleh {action.decidedBy ?? "(tidak diketahui)"} pada{" "}
                          {action.decidedAt !== null ? formatDate(action.decidedAt) : "-"}
                          {action.decisionNotes !== null ? ` — "${action.decisionNotes}"` : ""}
                        </p>
                      )}
                    </div>
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
