import { ReportClient } from "@/components/report/ReportClient";
import { getSimulator } from "@/lib/simulator";
import type { PersonaSummary } from "@/types/simulator.types";

/** All-scenarios report page (spec "All Scenarios Report (`/report`)"). Server Component for the same reason `/simulator/page.tsx` is — persona names for `AllScenariosTable` come from the real registry, not a hardcoded array. */
export default function ReportPage(): React.ReactElement {
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
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-xl font-semibold text-ink">📊 Laporan Semua Skenario</h1>
        <p className="text-sm text-ink-muted">10 persona, run sekaligus</p>
      </header>

      <ReportClient personas={personas} defaultTenantId={process.env["AAOS_SIMULATOR_TENANT_ID"]} />
    </main>
  );
}
