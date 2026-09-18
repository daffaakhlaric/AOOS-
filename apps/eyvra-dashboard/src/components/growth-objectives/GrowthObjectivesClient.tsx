"use client";

import { useCallback, useEffect, useState } from "react";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  AREA_STRATEGIES,
  AUTOMATION_MODES,
  BUDGET_MODES,
  type AreaStrategy,
  type AutomationMode,
  type BudgetMode,
  type CreateGrowthObjectiveInput,
  type GrowthObjectiveListResponseDto,
  type GrowthObjectiveResponseDto,
  type GrowthObjectiveStatus,
} from "@/types/growth-objective.types";

import styles from "./GrowthObjectivesClient.module.css";

const STATUS_LABELS: Record<GrowthObjectiveStatus, string> = {
  DRAFT: "Draft",
  ANALYZING: "Menganalisis",
  PLANNED: "Terencana",
  ACTIVE: "Aktif",
  ON_TRACK: "On Track",
  AT_RISK: "Berisiko",
  OFF_TRACK: "Melenceng",
  REPLANNING: "Rencana Ulang",
  COMPLETED: "Selesai",
  PAUSED: "Dijeda",
};

/**
 * Status badge color convention mirrors `CampaignHealthCard`/`AndromedaHealthCard`'s own real
 * status-badge palette (see this component's own module.css): neutral for not-yet-running states,
 * green for on-track/active, amber for at-risk, red for off-track, a distinct "done" color for
 * completed, neutral again for paused/replanning.
 */
function statusBadgeClass(status: GrowthObjectiveStatus): string {
  switch (status) {
    case "DRAFT":
    case "ANALYZING":
    case "PLANNED":
    case "PAUSED":
    case "REPLANNING":
      return styles.badgeNeutral ?? "";
    case "ACTIVE":
    case "ON_TRACK":
      return styles.badgeGood ?? "";
    case "AT_RISK":
      return styles.badgeWarn ?? "";
    case "OFF_TRACK":
      return styles.badgeBad ?? "";
    case "COMPLETED":
      return styles.badgeDone ?? "";
  }
}

const BUDGET_MODE_LABELS: Record<BudgetMode, string> = {
  GOAL_FIRST: "Goal First",
  BUDGET_FIRST: "Budget First",
  BALANCED: "Balanced",
};

const AREA_STRATEGY_LABELS: Record<AreaStrategy, string> = {
  SAMANTHA: "Samantha Recommend",
  MANUAL: "Manual",
};

const AUTOMATION_MODE_LABELS: Record<AutomationMode, string> = {
  ADVISOR: "Advisor",
  COPILOT: "Copilot",
  AUTOPILOT_GUARDED: "Guarded Autopilot",
  AUTONOMOUS: "Autonomous",
};

async function parseError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  return body.error?.message ?? fallback;
}

/**
 * `/growth-objectives` (EYVRA — SAMANTHA V2 Phase 15) — real fetch-on-mount list of
 * `growth_objectives` + a real "+ Buat Growth Objective" create modal, mirroring
 * `ListingsClient.tsx`/`ListingModal.tsx`'s real list+create-modal pattern (fetch-on-mount,
 * loading/error/empty states via `LoadingSpinner`/`ErrorCard`/`EmptyState`, refetch-after-create).
 *
 * This phase is list + create + read-only detail view only — `/analyze`, `/activate`,
 * `/check-progress`, `/pacing` UI triggers are explicitly Phase 16.
 */
export function GrowthObjectivesClient(): React.ReactElement {
  const [data, setData] = useState<GrowthObjectiveListResponseDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(() => {
    fetch("/api/growth-objectives")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await parseError(res, "Gagal memuat Growth Objectives."));
        }
        return (await res.json()) as GrowthObjectiveListResponseDto;
      })
      .then((body) => {
        setData(body);
        setError(undefined);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat Growth Objectives.");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error !== undefined && data === undefined) {
    return <ErrorCard message={error} />;
  }
  if (data === undefined) {
    return <LoadingSpinner />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.primaryButton} onClick={() => setShowModal(true)}>
          + Buat Growth Objective
        </button>
      </div>

      {error !== undefined ? <ErrorCard message={error} /> : null}

      {data.objectives.length === 0 ? (
        <EmptyState
          title="Belum ada Growth Objective"
          description="Belum ada Growth Objective — buat yang pertama."
        />
      ) : (
        <div className={styles.grid} data-testid="growth-objective-grid">
          {data.objectives.map((objective) => (
            <ObjectiveCard key={objective.id} objective={objective} />
          ))}
        </div>
      )}

      {showModal ? (
        <CreateGrowthObjectiveModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function ObjectiveCard({
  objective,
}: {
  readonly objective: GrowthObjectiveResponseDto;
}): React.ReactElement {
  const progressPct = objective.progress?.progressPct;
  return (
    <div data-testid="growth-objective-card" className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.metric}>
          {objective.metric === "HOT_LEADS" ? "Hot Leads" : objective.metric}
        </span>
        <span
          data-testid="objective-status-badge"
          className={`${styles.badge} ${statusBadgeClass(objective.status)}`}
        >
          {STATUS_LABELS[objective.status]}
        </span>
      </div>
      <p className={styles.target}>Target: {objective.targetValue.toLocaleString("id-ID")}</p>
      <p className={styles.dateRange}>
        {objective.startDate} — {objective.endDate}
      </p>
      <div className={styles.metaRow}>
        <span className={styles.metaChip}>{BUDGET_MODE_LABELS[objective.budgetMode]}</span>
        <span className={styles.metaChip}>{AUTOMATION_MODE_LABELS[objective.automationMode]}</span>
      </div>
      {progressPct !== undefined ? (
        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${String(Math.min(100, Math.max(0, progressPct)))}%` }}
            />
          </div>
          <span className={styles.progressLabel}>{Math.round(progressPct)}%</span>
        </div>
      ) : (
        <p className={styles.noProgress}>Belum ada data progress</p>
      )}
    </div>
  );
}

function CreateGrowthObjectiveModal({
  onClose,
  onCreated,
}: {
  readonly onClose: () => void;
  readonly onCreated: () => void;
}): React.ReactElement {
  const [targetValue, setTargetValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetMode, setBudgetMode] = useState<BudgetMode>("GOAL_FIRST");
  const [maxBudgetIdr, setMaxBudgetIdr] = useState("");
  const [areaStrategy, setAreaStrategy] = useState<AreaStrategy>("SAMANTHA");
  const [automationMode, setAutomationMode] = useState<AutomationMode>("ADVISOR");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  function validate(): string | undefined {
    if (targetValue.trim().length === 0 || Number.isNaN(Number(targetValue))) {
      return "Target Hot Leads wajib diisi dengan angka.";
    }
    if (Number(targetValue) <= 0) {
      return "Target Hot Leads harus lebih dari 0.";
    }
    if (startDate.length === 0 || endDate.length === 0) {
      return "Tanggal mulai dan tanggal selesai wajib diisi.";
    }
    if (endDate < startDate) {
      return "Tanggal selesai harus sama atau setelah tanggal mulai.";
    }
    if (maxBudgetIdr.trim().length > 0 && Number.isNaN(Number(maxBudgetIdr))) {
      return "Budget maksimal harus berupa angka.";
    }
    return undefined;
  }

  async function handleSave(): Promise<void> {
    const validationError = validate();
    if (validationError !== undefined) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      // PHASE-SCOPE DEVIATION (deliberate, see `growth-objective.types.ts`'s own doc):
      // `focusListingIds`/`manualAreas` are real, optional backend fields but this phase's form
      // has no listing/area picker UI, so both are simply omitted here.
      const payload: CreateGrowthObjectiveInput = {
        metric: "HOT_LEADS",
        targetValue: Number(targetValue),
        startDate,
        endDate,
        budgetMode,
        ...(maxBudgetIdr.trim().length > 0 ? { maxBudgetIdr: Number(maxBudgetIdr) } : {}),
        areaStrategy,
        automationMode,
      };
      const response = await fetch("/api/growth-objectives", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseError(response, "Gagal membuat Growth Objective."));
      }
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal membuat Growth Objective.");
    } finally {
      setSaving(false);
    }
  }

  const showMaxBudget = budgetMode === "BUDGET_FIRST" || budgetMode === "BALANCED";

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Growth Objective">
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>+ Buat Growth Objective</span>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.formGroup}>
            <label htmlFor="go-target" className={styles.formLabel}>
              Target Hot Leads *
            </label>
            <input
              id="go-target"
              type="number"
              className={styles.formInput}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="50"
            />
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label htmlFor="go-start" className={styles.formLabel}>
                Tanggal Mulai *
              </label>
              <input
                id="go-start"
                type="date"
                className={styles.formInput}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="go-end" className={styles.formLabel}>
                Tanggal Selesai *
              </label>
              <input
                id="go-end"
                type="date"
                className={styles.formInput}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label htmlFor="go-budget-mode" className={styles.formLabel}>
                Budget Mode *
              </label>
              <select
                id="go-budget-mode"
                className={styles.formInput}
                value={budgetMode}
                onChange={(e) => setBudgetMode(e.target.value as BudgetMode)}
              >
                {BUDGET_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {BUDGET_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </div>
            {showMaxBudget ? (
              <div className={styles.formGroup}>
                <label htmlFor="go-max-budget" className={styles.formLabel}>
                  Budget Maksimal (IDR)
                </label>
                <input
                  id="go-max-budget"
                  type="number"
                  className={styles.formInput}
                  value={maxBudgetIdr}
                  onChange={(e) => setMaxBudgetIdr(e.target.value)}
                  placeholder="5000000"
                />
              </div>
            ) : null}
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label htmlFor="go-area-strategy" className={styles.formLabel}>
                Strategi Area *
              </label>
              <select
                id="go-area-strategy"
                className={styles.formInput}
                value={areaStrategy}
                onChange={(e) => setAreaStrategy(e.target.value as AreaStrategy)}
              >
                {AREA_STRATEGIES.map((strategy) => (
                  <option key={strategy} value={strategy}>
                    {AREA_STRATEGY_LABELS[strategy]}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="go-automation-mode" className={styles.formLabel}>
                Automation Mode *
              </label>
              <select
                id="go-automation-mode"
                className={styles.formInput}
                value={automationMode}
                onChange={(e) => setAutomationMode(e.target.value as AutomationMode)}
              >
                {AUTOMATION_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {AUTOMATION_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error !== undefined ? <p className={styles.error}>{error}</p> : null}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className={styles.saveButton}
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
