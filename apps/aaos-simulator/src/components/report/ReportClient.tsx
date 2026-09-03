"use client";

import { useEffect, useState } from "react";

import { ApproveButton } from "@/components/simulator/ApproveButton";
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
}

/**
 * Client-side orchestrator for `/report` (spec "All Scenarios Report"). Runs all 10 scenarios
 * automatically on mount by calling `POST /api/simulate-all` (design resolution #5: never imports
 * `@aos/conversation-simulator`/`@aos/ai-judge` directly). Not one of the spec's literally-named
 * components, added for the same reason as `SimulatorClient` — see its file-level doc.
 */
export function ReportClient({ personas }: ReportClientProps): React.ReactElement {
  const [data, setData] = useState<SimulateAllResponse | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      setIsLoading(true);
      setError(undefined);
      try {
        const response = await fetch("/api/simulate-all", { method: "POST" });
        const body = (await response.json()) as SimulateAllResponse | ApiErrorResponse;
        if (cancelled) {
          return;
        }
        if (!response.ok || "error" in body) {
          setError("error" in body ? body.error.message : "Gagal menjalankan semua skenario.");
          return;
        }
        setData(body);
      } catch {
        if (!cancelled) {
          setError("Gagal terhubung ke server. Coba lagi.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const personaNames: Record<string, string> = {};
  for (const persona of personas) {
    personaNames[persona.id] = persona.name;
  }

  // Scope boundary (design resolution #3): purely local UI state, never persisted anywhere — see
  // `ApproveButton`'s own file-level doc for the full rationale.
  function handleApprove(): void {
    setApproved(true);
  }

  if (isLoading) {
    return <LoadingSpinner label="Menjalankan 10 skenario..." />;
  }

  if (error) {
    return <ErrorCard message={error} />;
  }

  if (!data) {
    return <ErrorCard message="Tidak ada data laporan." />;
  }

  return (
    <div className="flex flex-col gap-6">
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
