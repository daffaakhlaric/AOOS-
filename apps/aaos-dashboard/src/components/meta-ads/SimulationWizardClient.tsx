"use client";

import { useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useCampaignsSnapshot } from "@/lib/useCampaignsSnapshot";
import type {
  CampaignAdDto,
  ObjectiveDto,
  SimulationHistoryEntryDto,
  SimulationStatusDto,
} from "@/types/dashboard.types";

import styles from "./SimulationWizardClient.module.css";

const FREQUENCY_THRESHOLD = 3.5;
const POLL_INTERVAL_MS = 3000;

const AD_ANGLES = [
  "DP_RINGAN",
  "KREDIT_SYARIAH",
  "GUDANGNYA",
  "QNA",
  "DISCOVERY",
  "TESTIMONIAL",
  "WEBSITE_REDIRECT",
] as const;

/** The real 10 `PersonaId` members (`@aos/conversation-simulator`'s `PersonaId` enum, verified against source — see this component's class doc) — never the spec's own illustrative "Pak Andi/Bu Sari" 4-persona naming. */
const PERSONAS: ReadonlyArray<{ readonly id: string; readonly label: string }> = [
  { id: "cold_buyer", label: "Cold Buyer" },
  { id: "budget_buyer", label: "Budget Buyer" },
  { id: "ready_buyer", label: "Ready Buyer" },
  { id: "specific_unit_buyer", label: "Specific Unit" },
  { id: "kredit_buyer", label: "Kredit Buyer" },
  { id: "syariah_buyer", label: "Syariah Buyer" },
  { id: "ghost_buyer", label: "Ghost Buyer" },
  { id: "complainer_buyer", label: "Complainer" },
  { id: "first_time_buyer", label: "First-Time Buyer" },
  { id: "urgent_buyer", label: "Urgent Buyer" },
];

/** The real `Branch` enum (`@aos/meta-ads-connector`'s `Branch.ts`, verified against source). */
const BRANCHES = ["CINERE", "BINTARO", "BANDUNG", "JABODETABEK", "BOOST", "MULTI", "UMUM"] as const;

const STEPS = ["SETUP", "TAMARA", "KAI", "JESSY", "JUDGE", "REVIEW"] as const;
type WizardStep = (typeof STEPS)[number];

function needsRefresh(ad: CampaignAdDto): boolean {
  return ad.verdict === "REFRESH" || ad.metrics.frequency >= FREQUENCY_THRESHOLD;
}

function stepIndex(step: string): number {
  const index = STEPS.indexOf(step as WizardStep);
  return index === -1 ? 0 : index;
}

function badgeClass(status: "pending" | "ok" | "warn" | "error"): string {
  switch (status) {
    case "ok":
      return `${styles.badge} ${styles.badgeOk}`;
    case "warn":
      return `${styles.badge} ${styles.badgeWarn}`;
    case "error":
      return `${styles.badge} ${styles.badgeError}`;
    default:
      return `${styles.badge} ${styles.badgePending}`;
  }
}

function verdictClass(verdict: string): string {
  switch (verdict) {
    case "GO":
      return `${styles.verdictBadge} ${styles.verdictGo}`;
    case "CONDITIONAL":
      return `${styles.verdictBadge} ${styles.verdictConditional}`;
    case "NO-GO":
      return `${styles.verdictBadge} ${styles.verdictNoGo}`;
    default:
      return `${styles.verdictBadge} ${styles.verdictIncomplete}`;
  }
}

/**
 * "Simulasi Tamara × Kai × Jessy" — the 6-step dry-run wizard (Setup → Tamara → Kai → Jessy →
 * AI Judge → Review) from `docs/PROMPT-AAOS-DASHBOARD-SIMULASI-TAMARA-KAI-JESSY.md`, rebuilding
 * the old 4-step client-side-only `SimulasiClient.tsx` preview.
 *
 * HARD SCOPE BOUNDARY: nothing in this component can execute a real Meta Ads change, activate
 * WhatsApp auto-reply, or touch CAPI. "Approve"/"Reject" in Step 6 only record the manager's
 * decision (`POST /api/simulation/:id/{approve,reject}`) — no `/api/verdicts` call, no campaign
 * creation. A manager who wants to act on a verdict for real already has `/meta-ads/strategi`.
 *
 * Every number/log line shown here traces back to a real `aaos-api` response
 * (`GET /api/simulation/:id/status`, itself sourced from real `/api/v1/llm/analyze`,
 * `/api/v1/llm/creative-brief`, and `apps/aaos-simulator`'s `/api/simulate`) — no fabricated
 * per-line "streaming" log, no invented Jessy turns or Judge scores. Step 3's real Kie AI video
 * generation is NOT invoked in this pass (see `simulation.service.ts`'s class doc on the backend)
 * — the Kai stage card below shows the real brief plus an honest "belum tersedia" note instead of
 * a fabricated video/image preview.
 */
export function SimulationWizardClient(): React.ReactElement {
  const {
    data: campaignsData,
    loading: campaignsLoading,
    error: campaignsError,
    pull,
  } = useCampaignsSnapshot();

  const [objective, setObjective] = useState<ObjectiveDto | null | undefined>(undefined);
  const [objectiveLoading, setObjectiveLoading] = useState(true);
  const [objectiveError, setObjectiveError] = useState<string | undefined>(undefined);

  const [campaignDataSource, setCampaignDataSource] = useState<"cache" | "fresh">("cache");
  const [selectedAd, setSelectedAd] = useState<CampaignAdDto | undefined>(undefined);
  const [angle, setAngle] = useState<string>(AD_ANGLES[0]);
  const [branch, setBranch] = useState<string>(BRANCHES[0]);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<readonly string[]>([]);

  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | undefined>(undefined);
  const [simulationId, setSimulationId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<SimulationStatusDto | undefined>(undefined);
  const [statusError, setStatusError] = useState<string | undefined>(undefined);

  const [decisionPending, setDecisionPending] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<readonly SimulationHistoryEntryDto[] | undefined>(
    undefined,
  );
  const [historyLoading, setHistoryLoading] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setObjectiveLoading(true);
    // Real bug fix: this used to parse `res.json()` unconditionally and read `body.objective` off
    // it — on any non-2xx response (route error, not "no objective set") the body is shaped
    // `{ error: { message } }` instead, so `body.objective` silently came back `undefined`. Both
    // JSX branches below only handle `null`/a real `ObjectiveDto`, so `undefined` rendered
    // NOTHING — Step 1 looked like the objective section had vanished, with no error shown either.
    fetch("/api/objective")
      .then(async (res) => {
        const body = (await res.json()) as {
          objective?: ObjectiveDto | null;
          error?: { message?: string };
        };
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          setObjectiveError(body.error?.message ?? "Gagal memuat objective.");
          setObjective(null);
          return;
        }
        setObjective(body.objective ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setObjectiveError("Gagal memuat objective.");
          setObjective(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setObjectiveLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (simulationId === undefined) {
      return;
    }
    async function poll(): Promise<void> {
      try {
        const res = await fetch(`/api/simulation/${simulationId}/status`);
        if (!res.ok) {
          const body = (await res.json()) as { error?: { message?: string } };
          setStatusError(body.error?.message ?? "Gagal memuat status simulasi.");
          return;
        }
        const body = (await res.json()) as SimulationStatusDto;
        setStatus(body);
        setStatusError(undefined);
        if (body.status !== "RUNNING" && pollRef.current !== undefined) {
          clearInterval(pollRef.current);
          pollRef.current = undefined;
        }
      } catch {
        setStatusError("Gagal memuat status simulasi.");
      }
    }
    void poll();
    pollRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current !== undefined) {
        clearInterval(pollRef.current);
        pollRef.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-runs only when simulationId changes; `poll` itself always reads the latest `simulationId` via closure.
  }, [simulationId]);

  function togglePersona(id: string): void {
    setSelectedPersonaIds((current) =>
      current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
    );
  }

  async function startSimulation(): Promise<void> {
    if (selectedAd === undefined || selectedPersonaIds.length === 0) {
      return;
    }
    setStarting(true);
    setStartError(undefined);
    try {
      const res = await fetch("/api/simulation/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          objective: objective ?? {},
          campaignDataSource,
          campaigns: campaignsData?.campaigns ?? [],
          totals: campaignsData?.totals,
          kaiAd: {
            name: selectedAd.name,
            branch: selectedAd.branch,
            metrics: {
              spend: selectedAd.metrics.spend,
              frequency: selectedAd.metrics.frequency,
              totalLead: selectedAd.metrics.totalLead,
            },
          },
          kaiAngle: angle,
          kaiBranch: selectedAd.branch,
          personaIds: selectedPersonaIds,
          branch,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: { message?: string } };
        setStartError(body.error?.message ?? "Gagal memulai simulasi.");
        return;
      }
      const body = (await res.json()) as { id: string };
      setSimulationId(body.id);
      setStatus(undefined);
    } catch {
      setStartError("Gagal memulai simulasi.");
    } finally {
      setStarting(false);
    }
  }

  async function decide(decision: "approve" | "reject"): Promise<void> {
    if (simulationId === undefined) {
      return;
    }
    setDecisionPending(true);
    try {
      const res = await fetch(`/api/simulation/${simulationId}/${decision}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: decisionNotes.length > 0 ? decisionNotes : undefined }),
      });
      if (res.ok) {
        const body = (await res.json()) as SimulationStatusDto;
        setStatus(body);
      }
    } finally {
      setDecisionPending(false);
    }
  }

  async function loadHistory(): Promise<void> {
    setHistoryOpen((open) => !open);
    if (history !== undefined) {
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/simulation/history");
      const body = (await res.json()) as { history?: readonly SimulationHistoryEntryDto[] };
      setHistory(body.history ?? []);
    } finally {
      setHistoryLoading(false);
    }
  }

  // Real bug fix: this used to be `.filter(needsRefresh)` — when no cached ad happened to need a
  // refresh, the list was permanently empty, `selectedAd` could never be set, and "Mulai Simulasi
  // Dry-Run" stayed disabled forever with no way out. Kai's brief step just needs SOME real ad to
  // brief on, not specifically one that needs refreshing — so every real ad is selectable, with
  // ones that DO need a refresh sorted first (still visually flagged) rather than being the only
  // ones offered.
  const candidates = [...(campaignsData?.ads ?? [])].sort(
    (a, b) => Number(needsRefresh(b)) - Number(needsRefresh(a)),
  );
  const currentStep = status !== undefined ? stepIndex(status.currentStep) : 0;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>🎬 Simulasi Tamara × Kai × Jessy</h2>
          <p className={styles.subtitle}>
            Dry-run 6 langkah — preview & skor rencana campaign sebelum GO LIVE.
          </p>
        </div>
        <button type="button" onClick={() => void loadHistory()} className={styles.secondaryButton}>
          {historyOpen ? "Tutup Riwayat" : "Riwayat"}
        </button>
      </div>

      {historyOpen ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Riwayat Simulasi</h3>
          {historyLoading ? <LoadingSpinner /> : null}
          {!historyLoading && (history?.length ?? 0) === 0 ? (
            <p className={styles.mutedText}>Belum ada simulasi yang pernah dijalankan.</p>
          ) : null}
          <div className={styles.historyTable}>
            {(history ?? []).map((entry) => (
              <div key={entry.id} className={styles.historyRow}>
                <span>{entry.id.slice(0, 8)}</span>
                <span>{entry.status}</span>
                <span>
                  {entry.overallScore !== undefined
                    ? `${entry.overallScore} (${entry.grade})`
                    : "—"}
                </span>
                <span>{entry.decision ?? "—"}</span>
                <span>{new Date(entry.createdAt).toLocaleString("id-ID")}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className={styles.stepBar}>
        {STEPS.map((step, index) => (
          <span
            key={step}
            className={`${styles.stepPill} ${
              index === currentStep && status?.status === "RUNNING"
                ? styles.stepPillActive
                : index < currentStep || status?.status === "DONE" || status?.status === "ERROR"
                  ? styles.stepPillDone
                  : ""
            }`}
          >
            {index + 1}. {step}
          </span>
        ))}
      </div>

      {/* Step 1: Setup */}
      <section data-testid="wizard-step-setup" className={styles.section}>
        <h3 className={styles.sectionTitle}>Step 1 — Setup</h3>

        {objectiveLoading ? <LoadingSpinner /> : null}
        {!objectiveLoading && objectiveError !== undefined ? (
          <ErrorCard message={objectiveError} />
        ) : null}
        {!objectiveLoading && objectiveError === undefined && objective === null ? (
          <p className={styles.mutedText}>
            Belum ada objective bulan ini — atur di halaman Objective.
          </p>
        ) : null}
        {!objectiveLoading && objective !== null && objective !== undefined ? (
          <p className={styles.rowText}>
            Target {objective.targetHotLeads} hot leads · Budget Rp{" "}
            {objective.budgetAllocation.toLocaleString("id-ID")} · Fokus:{" "}
            {objective.focusUnits.join(", ") || "-"}
          </p>
        ) : null}

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Sumber data campaign</label>
          <select
            value={campaignDataSource}
            onChange={(event) => setCampaignDataSource(event.target.value as "cache" | "fresh")}
            className={styles.select}
          >
            <option value="cache">Pakai cache yang ada</option>
            <option value="fresh">Tarik data terbaru</option>
          </select>
          {campaignDataSource === "fresh" ? (
            <button type="button" onClick={() => void pull()} className={styles.secondaryButton}>
              Tarik data sekarang
            </button>
          ) : null}
        </div>

        {campaignsLoading ? <LoadingSpinner /> : null}
        {!campaignsLoading && campaignsError !== undefined ? (
          <ErrorCard message={campaignsError} />
        ) : null}
        {!campaignsLoading && campaignsData === undefined ? (
          <EmptyState
            title="Belum ada data"
            description="Tarik data di halaman Data Iklan terlebih dahulu."
          />
        ) : null}

        {campaignsData !== undefined ? (
          <>
            <p className={styles.formLabel}>
              Pilih iklan untuk brief Kai (yang butuh REFRESH ditandai)
            </p>
            {candidates.length === 0 ? (
              <p className={styles.mutedText}>
                Belum ada data iklan — tarik data di halaman Data Iklan.
              </p>
            ) : (
              <div className={styles.list}>
                {candidates.map((ad) => (
                  <button
                    key={ad.id}
                    type="button"
                    onClick={() => {
                      setSelectedAd(ad);
                      setBranch(ad.branch);
                    }}
                    className={`${styles.row} ${selectedAd?.id === ad.id ? styles.rowSelected : ""}`}
                  >
                    <span className={styles.rowText}>
                      {needsRefresh(ad) ? "⚠ " : ""}
                      {ad.stableId} {ad.name} · {ad.verdict} · freq{" "}
                      {ad.metrics.frequency.toFixed(1)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Angle creative (Kai)</label>
              <select
                value={angle}
                onChange={(event) => setAngle(event.target.value)}
                className={styles.select}
              >
                {AD_ANGLES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Persona Jessy (pilih minimal 1)</label>
              <div className={styles.personaGrid}>
                {PERSONAS.map((persona) => (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => togglePersona(persona.id)}
                    className={`${styles.personaChip} ${
                      selectedPersonaIds.includes(persona.id) ? styles.personaChipSelected : ""
                    }`}
                  >
                    {persona.label}
                  </button>
                ))}
              </div>
            </div>

            {startError !== undefined ? <ErrorCard message={startError} /> : null}

            <button
              type="button"
              onClick={() => void startSimulation()}
              disabled={starting || selectedAd === undefined || selectedPersonaIds.length === 0}
              className={styles.primaryButton}
            >
              {starting ? "Memulai…" : "Mulai Simulasi Dry-Run"}
            </button>
          </>
        ) : null}
      </section>

      {/* Steps 2-5: live pipeline status */}
      {simulationId !== undefined ? (
        <section data-testid="wizard-pipeline" className={styles.section}>
          <h3 className={styles.sectionTitle}>Pipeline — {simulationId.slice(0, 8)}</h3>
          {statusError !== undefined ? <ErrorCard message={statusError} /> : null}
          {status === undefined ? <LoadingSpinner /> : null}

          {status !== undefined ? (
            <div className={styles.stageGrid}>
              <TamaraStageCard status={status} />
              <KaiStageCard status={status} />
              <JessyStageCard status={status} />
            </div>
          ) : null}

          {status !== undefined && status.logs.length > 0 ? (
            <div className={styles.logPanel}>
              {status.logs.map((entry, index) => (
                <p
                  key={`${entry.createdAt}-${index}`}
                  className={`${styles.logLine} ${
                    entry.level === "WARN"
                      ? styles.logLineWarn
                      : entry.level === "ERROR"
                        ? styles.logLineError
                        : ""
                  }`}
                >
                  [{new Date(entry.createdAt).toLocaleTimeString("id-ID")}] {entry.step}:{" "}
                  {entry.message}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Step 6: Review & Approve */}
      {status?.result !== undefined ? (
        <section data-testid="wizard-step-review" className={styles.section}>
          <h3 className={styles.sectionTitle}>Step 6 — Review &amp; Approve</h3>
          <div className={styles.scoreCard}>
            <span className={styles.scoreBig}>{status.result.scoring.overallScore}</span>
            <div className={styles.scoreBreakdown}>
              <span>Grade {status.result.scoring.grade}</span>
              <span>
                Tamara {status.result.scoring.tamaraCoverageScore} · Kai{" "}
                {status.result.scoring.kaiScore} · Jessy{" "}
                {status.result.scoring.jessyScore.toFixed(1)}
              </span>
            </div>
            <span className={verdictClass(status.result.scoring.verdict)}>
              {status.result.scoring.verdict}
            </span>
          </div>

          {status.decision === undefined ? (
            <>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Catatan (opsional)</label>
                <input
                  type="text"
                  value={decisionNotes}
                  onChange={(event) => setDecisionNotes(event.target.value)}
                  className={styles.select}
                  placeholder="Catatan untuk riwayat…"
                />
              </div>
              <div className={styles.formRow} style={{ flexDirection: "row", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => void decide("approve")}
                  disabled={decisionPending}
                  className={styles.primaryButton}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void decide("reject")}
                  disabled={decisionPending}
                  className={styles.secondaryButton}
                >
                  Reject
                </button>
              </div>
              <p className={styles.mutedText}>
                Approve/Reject hanya mencatat keputusan pada riwayat simulasi ini — tidak membuat
                campaign Meta, tidak mengaktifkan WhatsApp/CAPI. Untuk eksekusi verdict yang
                sesungguhnya, gunakan halaman Strategi.
              </p>
            </>
          ) : (
            <p className={styles.rowText}>
              Keputusan tercatat: <strong>{status.decision}</strong>
              {status.decisionNotes !== undefined ? ` — ${status.decisionNotes}` : ""}
            </p>
          )}
        </section>
      ) : null}

      {status?.status === "ERROR" ? (
        <ErrorCard message={status.errorMessage ?? "Simulasi gagal."} />
      ) : null}
    </div>
  );
}

function TamaraStageCard({ status }: { readonly status: SimulationStatusDto }): React.ReactElement {
  const tamara = status.result?.tamara;
  const pending = tamara === undefined;
  return (
    <div className={styles.stageCard}>
      <div className={styles.stageHeader}>
        <span className={styles.stageName}>Step 2 · Tamara</span>
        <span className={badgeClass(pending ? "pending" : tamara.available ? "ok" : "warn")}>
          {pending ? "Menunggu" : tamara.available ? "Selesai" : "Tidak tersedia"}
        </span>
      </div>
      {pending ? <p className={styles.mutedText}>Menunggu analisa Tamara…</p> : null}
      {!pending && tamara.available ? (
        <>
          <p className={styles.mutedText}>{tamara.ringkasan}</p>
          <p className={styles.mutedText}>
            {tamara.temuan?.length ?? 0} temuan · {tamara.rekomendasi?.length ?? 0} rekomendasi ·{" "}
            {tamara.elapsedMs}ms
          </p>
        </>
      ) : null}
      {!pending && !tamara.available ? <p className={styles.mutedText}>{tamara.reason}</p> : null}
    </div>
  );
}

function KaiStageCard({ status }: { readonly status: SimulationStatusDto }): React.ReactElement {
  const kai = status.result?.kai;
  const pending = kai === undefined;
  return (
    <div className={styles.stageCard}>
      <div className={styles.stageHeader}>
        <span className={styles.stageName}>Step 3 · Kai</span>
        <span className={badgeClass(pending ? "pending" : kai.available ? "ok" : "warn")}>
          {pending ? "Menunggu" : kai.available ? "Brief siap" : "Tidak tersedia"}
        </span>
      </div>
      {pending ? <p className={styles.mutedText}>Menunggu brief dari Tamara…</p> : null}
      {!pending && kai.available && kai.brief !== undefined ? (
        <>
          <p className={styles.rowText}>{kai.brief.primaryMessage}</p>
          <p className={styles.mutedText}>
            {kai.brief.angle} · {kai.brief.formats.join(", ")}
          </p>
        </>
      ) : null}
      {!pending ? <p className={styles.mutedText}>{kai.note}</p> : null}
    </div>
  );
}

function JessyStageCard({ status }: { readonly status: SimulationStatusDto }): React.ReactElement {
  const jessy = status.result?.jessy;
  const pending = jessy === undefined;
  return (
    <div className={styles.stageCard}>
      <div className={styles.stageHeader}>
        <span className={styles.stageName}>Step 4-5 · Jessy + Judge</span>
        <span
          className={badgeClass(
            pending
              ? "pending"
              : !jessy.available
                ? "warn"
                : jessy.runs.some((r) => !r.ok)
                  ? "warn"
                  : "ok",
          )}
        >
          {pending
            ? "Menunggu"
            : jessy.available
              ? `${jessy.runs.length} persona`
              : "Tidak tersedia"}
        </span>
      </div>
      {pending ? <p className={styles.mutedText}>Menunggu simulasi Jessy…</p> : null}
      {!pending && !jessy.available ? <p className={styles.mutedText}>{jessy.reason}</p> : null}
      {!pending && jessy.available ? (
        <div className={styles.list}>
          {jessy.runs.map((run) => (
            <div key={run.personaId} className={styles.row}>
              <span className={styles.rowText}>{run.personaId}</span>
              <span className={styles.mutedText}>
                {run.ok ? `${run.overallScore} (${run.grade})` : run.error}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
