"use client";

import { useCallback, useEffect, useState } from "react";
import { LineChart } from "@tremor/react";

import { TopBar } from "@/components/layout/TopBar";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type {
  AgentConfigDto,
  JudgeHistoryPointDto,
  LearningProposalDto,
  PromptOverrideDto,
  TriggerCheckResultDto,
} from "@/types/learning.types";
import type { PendingActionDto } from "@/types/pending-actions.types";

import styles from "./LearningMonitorClient.module.css";

const STATUS_OPTIONS = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "AUTO_APPLIED",
  "AUTO_APPLY_BLOCKED_BY_SANDBOX",
] as const;

/** AAOS Self-Improving, Phase SI-6 — real, honest status badge for EVERY real proposal status a `learning_proposals` row can carry today (PENDING/APPROVED/REJECTED from Phase C, AUTO_APPLIED/AUTO_APPLY_BLOCKED_BY_SANDBOX from Phase SI-1/SI-5). There is no real `ROLLED_BACK` status anywhere in this codebase (see `JudgeMemoryService`'s own doc for why, and `AccuracyCheckService`'s own doc for why a REGRESSED accuracy verdict is a passive flag, not this) — never fabricated a case for one. */
function statusBadgeClass(status: string): string {
  if (status === "APPROVED" || status === "AUTO_APPLIED") {
    return styles.statusApproved ?? "";
  }
  if (status === "REJECTED") {
    return styles.statusRejected ?? "";
  }
  if (status === "AUTO_APPLY_BLOCKED_BY_SANDBOX") {
    return styles.statusBlocked ?? "";
  }
  return styles.statusPending ?? "";
}

/** AAOS Self-Improving, Phase SI-6 — the real accuracy-check verdict badge (a SEPARATE concept from `status` above — see `LearningProposalDto.accuracyVerdict`'s own doc). */
function accuracyBadgeClass(verdict: "IMPROVED" | "REGRESSED" | "INCONCLUSIVE"): string {
  if (verdict === "IMPROVED") {
    return styles.statusApproved ?? "";
  }
  if (verdict === "REGRESSED") {
    return styles.statusRejected ?? "";
  }
  return styles.statusPending ?? "";
}

const HISTORY_AGENTS = ["SAMANTHA", "CLARA"] as const;

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

  // AAOS Self-Improving, Phase SI-6 — real Score Trend chart state (real `judge_results` history,
  // never fake data) + the real "Improve sekarang" manual-trigger state, both scoped to the SAME
  // selected agent (SAMANTHA/CLARA) since the trigger checks that agent's own latest real judged run.
  const [historyAgent, setHistoryAgent] = useState<(typeof HISTORY_AGENTS)[number]>("SAMANTHA");
  const [judgeHistory, setJudgeHistory] = useState<readonly JudgeHistoryPointDto[] | undefined>(
    undefined,
  );
  const [historyError, setHistoryError] = useState<string | undefined>(undefined);
  const [triggerBusy, setTriggerBusy] = useState(false);
  const [triggerResult, setTriggerResult] = useState<TriggerCheckResultDto | undefined>(undefined);

  // AAOS Self-Improving, Phase SI-6 — real `agent_configs` Config editor state.
  const [configs, setConfigs] = useState<readonly AgentConfigDto[] | undefined>(undefined);
  const [configError, setConfigError] = useState<string | undefined>(undefined);
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});
  const [configBusyKey, setConfigBusyKey] = useState<string | undefined>(undefined);
  const [newConfig, setNewConfig] = useState({ agent: "GLOBAL", configKey: "", value: "" });
  const [newConfigBusy, setNewConfigBusy] = useState(false);

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

  const loadJudgeHistory = useCallback(() => {
    setHistoryError(undefined);
    fetch(`/api/learning/judge-history?agent=${encodeURIComponent(historyAgent)}&days=30`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat riwayat skor.");
        }
        return (await res.json()) as readonly JudgeHistoryPointDto[];
      })
      .then(setJudgeHistory)
      .catch((caught: unknown) => {
        setHistoryError(caught instanceof Error ? caught.message : "Gagal memuat riwayat skor.");
      });
  }, [historyAgent]);

  const loadConfigs = useCallback(() => {
    fetch("/api/learning/configs")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat agent configs.");
        }
        return (await res.json()) as readonly AgentConfigDto[];
      })
      .then(setConfigs)
      .catch((caught: unknown) => {
        setConfigError(caught instanceof Error ? caught.message : "Gagal memuat agent configs.");
      });
  }, []);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  useEffect(() => {
    loadOverrides();
  }, [loadOverrides]);

  useEffect(() => {
    loadPendingActions();
  }, [loadPendingActions]);

  useEffect(() => {
    loadJudgeHistory();
  }, [loadJudgeHistory]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

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

  /** AAOS Self-Improving, Phase SI-6 — real "Improve sekarang" manual trigger for `historyAgent`. Refreshes proposals afterward regardless of `triggered` (an honest `false` result is still worth surfacing, not silently discarded). */
  async function handleTrigger(): Promise<void> {
    setTriggerBusy(true);
    setTriggerResult(undefined);
    try {
      const res = await fetch("/api/learning/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent: historyAgent }),
      });
      const body = (await res.json().catch(() => ({}))) as TriggerCheckResultDto & {
        error?: { message?: string };
      };
      if (!res.ok) {
        throw new Error(body.error?.message ?? "Gagal menjalankan Improve sekarang.");
      }
      setTriggerResult(body);
      loadProposals();
    } catch (caught) {
      setTriggerResult({
        triggered: false,
        reason: caught instanceof Error ? caught.message : "Gagal menjalankan Improve sekarang.",
      });
    } finally {
      setTriggerBusy(false);
    }
  }

  /** AAOS Self-Improving, Phase SI-6 — real `agent_configs` Config editor write (existing row). */
  async function handleSaveConfig(config: AgentConfigDto): Promise<void> {
    const key = `${config.agent}:${config.configKey}`;
    const draftValue = configDraft[key] ?? config.value;
    const parsed = Number(draftValue);
    if (!Number.isFinite(parsed)) {
      setConfigError(`Nilai untuk ${key} bukan angka yang valid.`);
      return;
    }
    setConfigBusyKey(key);
    setConfigError(undefined);
    try {
      const res = await fetch("/api/learning/configs", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent: config.agent, configKey: config.configKey, value: parsed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal menyimpan config.");
      }
      loadConfigs();
    } catch (caught) {
      setConfigError(caught instanceof Error ? caught.message : "Gagal menyimpan config.");
    } finally {
      setConfigBusyKey(undefined);
    }
  }

  /** AAOS Self-Improving, Phase SI-6 — real `agent_configs` Config editor write (new row, same real upsert path as `handleSaveConfig`). */
  async function handleCreateConfig(): Promise<void> {
    const parsed = Number(newConfig.value);
    if (newConfig.agent.trim().length === 0 || newConfig.configKey.trim().length === 0) {
      setConfigError("Agent dan config key wajib diisi.");
      return;
    }
    if (!Number.isFinite(parsed)) {
      setConfigError("Value harus berupa angka.");
      return;
    }
    setNewConfigBusy(true);
    setConfigError(undefined);
    try {
      const res = await fetch("/api/learning/configs", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent: newConfig.agent.trim(),
          configKey: newConfig.configKey.trim(),
          value: parsed,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal menambah config.");
      }
      setNewConfig({ agent: "GLOBAL", configKey: "", value: "" });
      loadConfigs();
    } catch (caught) {
      setConfigError(caught instanceof Error ? caught.message : "Gagal menambah config.");
    } finally {
      setNewConfigBusy(false);
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

        <div className={styles.section} data-testid="score-trend-section">
          <div className={styles.toolbar}>
            <span className={styles.sectionTitle}>Score Trend (30 hari)</span>
            <select
              className={styles.filterSelect}
              value={historyAgent}
              onChange={(e) => setHistoryAgent(e.target.value as (typeof HISTORY_AGENTS)[number])}
            >
              {HISTORY_AGENTS.map((agent) => (
                <option key={agent} value={agent}>
                  {agent}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.approveButton}
              disabled={triggerBusy}
              onClick={() => void handleTrigger()}
            >
              {triggerBusy ? "Memeriksa…" : "Improve sekarang"}
            </button>
          </div>

          {triggerResult !== undefined ? (
            <p className={triggerResult.triggered ? styles.decidedInfo : styles.errorText}>
              {triggerResult.triggered
                ? "Proposal baru sedang diproses (lihat daftar Improvement Proposals di atas)."
                : (triggerResult.reason ?? "Tidak ada perubahan.")}
            </p>
          ) : null}

          {historyError !== undefined ? <p className={styles.errorText}>{historyError}</p> : null}

          {judgeHistory === undefined ? (
            <LoadingSpinner />
          ) : judgeHistory.length === 0 ? (
            <p className={styles.emptyState}>
              Belum ada real judge_results untuk {historyAgent} dalam 30 hari terakhir.
            </p>
          ) : (
            <div className={styles.chartCard}>
              <LineChart
                data={judgeHistory.map((point) => ({
                  tanggal: formatDate(point.createdAt),
                  "Overall Score": point.overall ?? undefined,
                }))}
                index="tanggal"
                categories={["Overall Score"]}
                colors={["blue"]}
                minValue={0}
                maxValue={100}
                className={styles.chart}
              />
            </div>
          )}
        </div>

        <div className={styles.section} data-testid="config-editor-section">
          <span className={styles.sectionTitle}>Config Editor (agent_configs)</span>
          {configError !== undefined ? <p className={styles.errorText}>{configError}</p> : null}

          {configs === undefined ? (
            <LoadingSpinner />
          ) : configs.length === 0 ? (
            <p className={styles.emptyState}>
              Belum ada agent_configs untuk tenant ini — setiap threshold masih memakai default
              hardcoded-nya.
            </p>
          ) : (
            <table className={styles.overrideTable}>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Config Key</th>
                  <th>Value</th>
                  <th>Updated</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((config) => {
                  const key = `${config.agent}:${config.configKey}`;
                  return (
                    <tr key={config.id}>
                      <td>{config.agent}</td>
                      <td>{config.configKey}</td>
                      <td>
                        <input
                          type="text"
                          className={styles.notesInput}
                          value={configDraft[key] ?? config.value}
                          onChange={(e) =>
                            setConfigDraft((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                        />
                      </td>
                      <td>{formatDate(config.updatedAt)}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.rollbackButton}
                          disabled={configBusyKey === key}
                          onClick={() => void handleSaveConfig(config)}
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className={styles.actions}>
            <input
              type="text"
              placeholder="Agent (mis. GLOBAL, SAMANTHA)"
              className={styles.notesInput}
              value={newConfig.agent}
              onChange={(e) => setNewConfig((prev) => ({ ...prev, agent: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Config key"
              className={styles.notesInput}
              value={newConfig.configKey}
              onChange={(e) => setNewConfig((prev) => ({ ...prev, configKey: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Value (angka)"
              className={styles.notesInput}
              value={newConfig.value}
              onChange={(e) => setNewConfig((prev) => ({ ...prev, value: e.target.value }))}
            />
            <button
              type="button"
              className={styles.approveButton}
              disabled={newConfigBusy}
              onClick={() => void handleCreateConfig()}
            >
              Tambah / Set
            </button>
          </div>
        </div>

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

                        {proposal.accuracyVerdict !== null ? (
                          <div className={styles.accuracyBlock}>
                            <span
                              className={`${styles.statusBadge} ${accuracyBadgeClass(proposal.accuracyVerdict)}`}
                            >
                              ACCURACY: {proposal.accuracyVerdict}
                            </span>
                            {proposal.accuracyScoreBefore !== null &&
                            proposal.accuracyScoreAfter !== null ? (
                              <span className={styles.accuracyScores}>
                                {proposal.accuracyScoreBefore.toFixed(1)} →{" "}
                                {proposal.accuracyScoreAfter.toFixed(1)} (n=
                                {proposal.accuracySampleBefore ?? 0}/
                                {proposal.accuracySampleAfter ?? 0})
                              </span>
                            ) : null}
                            {proposal.accuracyReason !== null ? (
                              <p className={styles.accuracyReason}>{proposal.accuracyReason}</p>
                            ) : null}
                          </div>
                        ) : null}

                        {proposal.status === "PENDING" ||
                        proposal.status === "AUTO_APPLY_BLOCKED_BY_SANDBOX" ? (
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
                        ) : proposal.status === "AUTO_APPLIED" ? (
                          <p className={styles.decidedInfo}>
                            Diterapkan otomatis (AUTO_APPLIED) — tidak memerlukan persetujuan
                            manusia, sesuai kebijakan full auto-apply.
                          </p>
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
