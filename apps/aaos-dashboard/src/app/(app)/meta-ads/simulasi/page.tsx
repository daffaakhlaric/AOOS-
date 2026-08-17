import { TopBar } from "@/components/layout/TopBar";
import { SimulationWizardClient } from "@/components/meta-ads/SimulationWizardClient";

/**
 * Simulasi Tamara × Kai × Jessy page — the 6-step dry-run wizard from
 * `docs/PROMPT-AAOS-DASHBOARD-SIMULASI-TAMARA-KAI-JESSY.md`, replacing the earlier 4-step
 * client-side-only `SimulasiClient.tsx` preview (Tamara/Kai handoff only, no Jessy/Judge, no
 * backend persistence).
 */
export default function SimulasiPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Simulasi Tamara × Kai × Jessy" />
      <SimulationWizardClient />
    </main>
  );
}
