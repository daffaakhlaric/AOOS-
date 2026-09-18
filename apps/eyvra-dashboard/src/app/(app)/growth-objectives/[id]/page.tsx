import { GrowthObjectiveDetailClient } from "@/components/growth-objectives/GrowthObjectiveDetailClient";
import { TopBar } from "@/components/layout/TopBar";

/**
 * `/growth-objectives/:id` (EYVRA — SAMANTHA V2 Phase 16) — real detail view for one
 * `growth_objectives` row: forecast (`/analyze`), progress (`/check-progress`), pacing
 * (`/pacing`), and the real status-gated action buttons that trigger those backend transitions.
 * Mirrors `growth-objectives/page.tsx`'s (Phase 15) `TopBar` + Client-component shape.
 */
export default function GrowthObjectiveDetailPage({
  params,
}: {
  readonly params: { id: string };
}): React.ReactElement {
  return (
    <main>
      <TopBar title="Growth Objective" />
      <GrowthObjectiveDetailClient objectiveId={params.id} />
    </main>
  );
}
