import Link from "next/link";

import { SimulatorClient } from "@/components/simulator/SimulatorClient";
import { getSimulator } from "@/lib/simulator";
import type { PersonaSummary } from "@/types/simulator.types";

/**
 * Main simulator page (spec "Main Simulator Page (`/simulator`)"). A Server Component so the 10
 * persona cards' data comes straight from the real `@aos/conversation-simulator` `ListPersonas`
 * use case / `PersonaRegistry` (design resolution #2) — never a hardcoded client-side array that
 * could drift from the real persona definitions. `BuyerPersona` is already fully JSON-safe (every
 * field is a primitive, string array, or string enum), so no DTO mapping is needed here beyond
 * picking the 4 fields `PersonaSelector` actually renders.
 */
export default function SimulatorPage(): React.ReactElement {
  const simulatorResult = getSimulator();

  const personas: ReadonlyArray<PersonaSummary> = simulatorResult.ok
    ? simulatorResult.value.listPersonas.execute().map((persona) => ({
        id: persona.id,
        name: persona.name,
        difficulty: persona.difficulty,
        description: persona.description,
      }))
    : [];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">🎮 Jessy Simulator</h1>
          <p className="text-sm text-ink-muted">Test kualitas Jessy sebelum deploy ke WhatsApp</p>
        </div>
        <Link
          href="/report"
          className="rounded-button bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-card"
        >
          Run All Scenarios →
        </Link>
      </header>

      {!simulatorResult.ok && (
        <p role="alert" className="text-sm text-brand-danger">
          Gagal memuat daftar persona: {simulatorResult.error.message}
        </p>
      )}

      <SimulatorClient personas={personas} />
    </main>
  );
}
