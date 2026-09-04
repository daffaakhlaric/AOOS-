import { TopBar } from "@/components/layout/TopBar";
import { SimulationWizardClient } from "@/components/meta-ads/SimulationWizardClient";

/**
 * Simulasi Samantha × Kai × Clara page — the 6-step dry-run wizard from
 * `docs/PROMPT-AAOS-DASHBOARD-SIMULASI-TAMARA-KAI-JESSY.md`, replacing the earlier 4-step
 * client-side-only `SimulasiClient.tsx` preview (Samantha/Kai handoff only, no Clara/Judge, no
 * backend persistence).
 */
export default function SimulasiPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Simulasi Samantha × Kai × Clara" accentColor="var(--v2-menu-campaigns)" />
      <SimulationWizardClient />
    </main>
  );
}
