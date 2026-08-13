import { formatIdr, formatNumber } from "@/lib/formatters";
import type { ObjectiveDto } from "@/types/dashboard.types";

/** Current objective status (spec "components/objective/ObjectiveCard.tsx"). */
export function ObjectiveCard({
  objective,
}: {
  readonly objective: ObjectiveDto;
}): React.ReactElement {
  return (
    <section
      data-testid="objective-card"
      className="rounded-card border border-hairline bg-surface-card p-4 shadow-card"
    >
      <p className="text-sm text-ink-muted">
        Periode {objective.period.month}/{objective.period.year} · {objective.status}
      </p>
      <p className="mt-1 text-lg font-semibold text-ink">
        Target {formatNumber(objective.targetHotLeads)} hot leads
      </p>
      <p className="text-sm text-ink-muted">Budget {formatIdr(objective.budgetAllocation)}</p>
      <p className="mt-1 text-sm text-ink-muted">
        Fokus unit: {objective.focusUnits.join(", ")} · Area: {objective.areaPriorities.join(", ")}
      </p>
    </section>
  );
}
