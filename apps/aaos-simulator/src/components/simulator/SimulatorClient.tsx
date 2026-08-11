"use client";

import { useState } from "react";

import type { ApiErrorResponse, PersonaSummary, SimulateResponse } from "@/types/simulator.types";

import { ErrorCard } from "../ui/ErrorCard";

import { ApproveButton } from "./ApproveButton";
import { ConversationView } from "./ConversationView";
import { FeedbackPanel } from "./FeedbackPanel";
import { PersonaSelector } from "./PersonaSelector";
import { RunButton } from "./RunButton";
import { ScorePanel } from "./ScorePanel";

export interface SimulatorClientProps {
  /**
   * Sourced server-side from the real `@aos/conversation-simulator` `ListPersonas`/
   * `PersonaRegistry` (design resolution #2) by the parent Server Component (`src/app/simulator/
   * page.tsx`) — never a hardcoded client-side literal array.
   */
  readonly personas: ReadonlyArray<PersonaSummary>;
}

/**
 * Client-side orchestrator for the main simulator page's 3-column layout (spec "Main Simulator
 * Page"). Not one of the spec's literally-named components — added because persona selection,
 * run state, and the fetch to `/api/simulate` all need to live in one client boundary above
 * `PersonaSelector`/`ConversationView`/`ScorePanel`/`FeedbackPanel`/`RunButton`/`ApproveButton`
 * (design resolution #5: client components only ever call the Route Handlers via `fetch`, never
 * import `@aos/conversation-simulator`/`@aos/ai-judge` directly).
 */
export function SimulatorClient({ personas }: SimulatorClientProps): React.ReactElement {
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | undefined>(personas[0]?.id);
  const [result, setResult] = useState<SimulateResponse | undefined>(undefined);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [approved, setApproved] = useState(false);

  async function handleRun(): Promise<void> {
    if (!selectedPersonaId) {
      return;
    }
    setIsRunning(true);
    setError(undefined);
    setApproved(false);
    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId: selectedPersonaId }),
      });
      const body = (await response.json()) as SimulateResponse | ApiErrorResponse;
      if (!response.ok || "error" in body) {
        setError("error" in body ? body.error.message : "Simulasi gagal dijalankan.");
        setResult(undefined);
        return;
      }
      setResult(body);
    } catch {
      setError("Gagal terhubung ke server. Coba lagi.");
      setResult(undefined);
    } finally {
      setIsRunning(false);
    }
  }

  // Scope boundary (design resolution #3): purely local UI state, never persisted anywhere.
  function handleApprove(): void {
    setApproved(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(0,280px)]">
        <PersonaSelector
          personas={personas}
          selectedPersonaId={selectedPersonaId}
          onSelect={(personaId) => {
            setSelectedPersonaId(personaId);
            setResult(undefined);
            setApproved(false);
            setError(undefined);
          }}
        />

        <div className="flex flex-col gap-4 rounded-card border border-hairline bg-surface-card p-4 shadow-card">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Percakapan
          </h2>
          {error && <ErrorCard message={error} />}
          <ConversationView simulationResult={result?.simulationResult} />
          <RunButton onClick={handleRun} disabled={!selectedPersonaId} isRunning={isRunning} />
        </div>

        <div className="flex flex-col gap-4 rounded-card border border-hairline bg-surface-card p-4 shadow-card">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Score</h2>
          <ScorePanel judgementResult={result?.judgementResult} />
          <ApproveButton approved={approved} onApprove={handleApprove} disabled={!result} />
        </div>
      </div>

      <FeedbackPanel judgementResult={result?.judgementResult} />
    </div>
  );
}
