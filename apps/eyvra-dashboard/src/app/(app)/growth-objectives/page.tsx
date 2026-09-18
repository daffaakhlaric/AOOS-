import { GrowthObjectivesClient } from "@/components/growth-objectives/GrowthObjectivesClient";
import { TopBar } from "@/components/layout/TopBar";

/**
 * `/growth-objectives` (EYVRA — SAMANTHA V2 Phase 15) — the new `growth_objectives` business-GOAL
 * tracker ("get N Hot Leads by date X"). NOT the older, unrelated `/objective` page
 * (`property_objective`/`ObjectiveDto` business-context) — see `growth-objective.types.ts`'s own
 * doc for the full disambiguation. Deliberately NOT reachable via `Sidebar.tsx`'s fixed 7-item
 * `MENU` (out of this phase's scope) — reachable instead via a real link on `/campaigns`.
 */
export default function GrowthObjectivesPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Growth Objectives" />
      <GrowthObjectivesClient />
    </main>
  );
}
