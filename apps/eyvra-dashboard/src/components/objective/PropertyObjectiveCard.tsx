import { formatIdr, formatNumber } from "@/lib/formatters";
import type { PropertyObjectiveDto } from "@/types/property-objective.types";

import styles from "./PropertyObjectiveCard.module.css";

/**
 * PROPERTY tenants' "current objective" display (Phase O2). A genuinely separate component from
 * `ObjectiveCard.tsx`, not a shared one: `PropertyObjectiveResponseDto` and `ObjectiveDto` diverge
 * on real field names (`focusListings` vs. `focusUnits`, plus a real `budgetSource` this vertical
 * alone has — no `Branch`/car-model catalog coupling on this side), so `ObjectiveCard.tsx` cannot
 * honestly render this shape without either a fragile field-name coercion or an `isProperty`
 * branch inside it — the same reasoning `PropertyManualBriefForm.tsx` already established for why
 * a small separate component beats branching one shared one. `ObjectiveCard.tsx` itself is
 * untouched.
 */
export function PropertyObjectiveCard({
  objective,
}: {
  readonly objective: PropertyObjectiveDto;
}): React.ReactElement {
  return (
    <section data-testid="property-objective-card" className={styles.section}>
      <p className={styles.meta}>
        Periode {objective.period.month}/{objective.period.year} · {objective.status}
      </p>
      <p className={styles.target}>Target {formatNumber(objective.targetHotLeads)} hot leads</p>
      <p className={styles.meta}>
        Budget {formatIdr(objective.budgetAllocation)}
        {objective.budgetSource === "SAMANTHA_SUGGESTED" ? " (saran Samantha)" : " (manual)"}
      </p>
      <p className={styles.meta}>
        Fokus listing: {objective.focusListings.join(", ")} · Area:{" "}
        {objective.areaPriorities.join(", ")}
      </p>
    </section>
  );
}
