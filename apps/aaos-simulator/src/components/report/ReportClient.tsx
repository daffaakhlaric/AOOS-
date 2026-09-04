"use client";

import { useState } from "react";

import { ApproveButton } from "@/components/simulator/ApproveButton";
import {
  TenantVerticalSelector,
  type TenantVerticalSelection,
} from "@/components/simulator/TenantVerticalSelector";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type {
  ApiErrorResponse,
  PersonaSummary,
  SimulateAllResponse,
} from "@/types/simulator.types";

import { AllScenariosTable } from "./AllScenariosTable";
import { LearningBridgeStatus } from "./LearningBridgeStatus";
import { OverallVerdictCard } from "./OverallVerdictCard";
import { WeakestDimensionsChart } from "./WeakestDimensionsChart";

export interface ReportClientProps {
  readonly personas: ReadonlyArray<PersonaSummary>;
  /** `AAOS_SIMULATOR_TENANT_ID` server env, forwarded down as `TenantVerticalSelector`'s initial-pick hint only — see that component's own doc. */
  readonly defaultTenantId?: string;
}

/**
 * Client-side orchestrator for `/report` (spec "All Scenarios Report"). Runs all 10 scenarios by
 * calling `POST /api/simulate-all` (design resolution #5: never imports
 * `@aos/conversation-simulator`/`@aos/ai-judge` directly). Not one of the spec's literally-named
 * components, added for the same reason as `SimulatorClient` — see its file-level doc.
 *
 * This task: no longer auto-runs on mount with no tenant/vertical known (that's exactly the
 * hardcoded-AUTOMOTIVE bug this task fixes). A real tenant must be selected first
 * (`TenantVerticalSelector`, same real fetch/never-fabricated discipline as `SimulatorClient`'s own
 * selector) — "Jalankan Semua Skenario" is disabled until then, mirroring `SimulatorClient`'s own
 * Run-button-disabled-until-ready pattern.
 */
export function ReportClient({ personas, defaultTenantId }: ReportClientProps): React.ReactElement {
  const [selection, setSelection] = useState<TenantVerticalSelection | undefined>(undefined);
  const [data, setData] = useState<SimulateAllResponse | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [approved, setApproved] = useState(false);

  async function handleRun(): Promise<void> {
    if (!selection) {
      return;
    }
    setIsLoading(true);
    setError(undefined);
    setApproved(false);
    try {
      const response = await fetch("/api/simulate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: selection.tenantId,
          vertical: selection.vertical,
          ...(selection.listingId !== undefined ? { listingId: selection.listingId } : {}),
        }),
      });
      const body = (await response.json()) as SimulateAllResponse | ApiErrorResponse;
      if (!response.ok || "error" in body) {
        setError("error" in body ? body.error.message : "Gagal menjalankan semua skenario.");
        return;
      }
      setData(body);
    } catch {
      setError("Gagal terhubung ke server. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }

  const personaNames: Record<string, string> = {};
  for (const persona of personas) {
    personaNames[persona.id] = persona.name;
  }

  // Scope boundary (design resolution #3): purely local UI state, never persisted anywhere — see
  // `ApproveButton`'s own file-level doc for the full rationale.
  function handleApprove(): void {
    setApproved(true);
  }

  const selector = (
    <TenantVerticalSelector
      defaultTenantId={defaultTenantId}
      onSelectionChange={(next) => {
        setSelection(next);
        setData(undefined);
        setApproved(false);
        setError(undefined);
      }}
    />
  );

  const runButton = (
    <button
      type="button"
      data-testid="run-all-button"
      disabled={!selection || isLoading}
      onClick={() => void handleRun()}
      className="rounded-button bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-card disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isLoading ? "Menjalankan..." : "Jalankan Semua Skenario"}
    </button>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {selector}
        {runButton}
        <LoadingSpinner label="Menjalankan 10 skenario..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {selector}
        {runButton}
        <ErrorCard message={error} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        {selector}
        {runButton}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {selector}
      {runButton}
      <OverallVerdictCard report={data.report} />
      <LearningBridgeStatus status={data.learningBridge} />
      <AllScenariosTable results={data.results} personaNames={personaNames} />
      <WeakestDimensionsChart weakestDimensions={data.report.weakestDimensions} />

      {data.report.topPriorities.length > 0 && (
        <section
          data-testid="top-priorities"
          className="flex flex-col gap-2 rounded-card border border-hairline bg-surface-card p-4 shadow-card"
        >
          <h2 className="text-sm font-semibold text-ink">🎯 Prioritas Perbaikan</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
            {data.report.topPriorities.map((priority, index) => (
              <li key={index}>{priority}</li>
            ))}
          </ol>
        </section>
      )}

      <ApproveButton
        approved={approved}
        onApprove={handleApprove}
        label="Approve Clara untuk Deploy"
      />
    </div>
  );
}
