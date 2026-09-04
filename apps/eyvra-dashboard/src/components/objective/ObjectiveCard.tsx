import { formatIdr, formatNumber } from "@/lib/formatters";
import type { ObjectiveDto } from "@/types/dashboard.types";

import styles from "./ObjectiveCard.module.css";

/** Current objective status (spec "components/objective/ObjectiveCard.tsx"). */
export function ObjectiveCard({
  objective,
}: {
  readonly objective: ObjectiveDto;
}): React.ReactElement {
  return (
    <section data-testid="objective-card" className={styles.section}>
      <p className={styles.meta}>
        Periode {objective.period.month}/{objective.period.year} · {objective.status}
      </p>
      <p className={styles.target}>Target {formatNumber(objective.targetHotLeads)} hot leads</p>
      <p className={styles.meta}>Budget {formatIdr(objective.budgetAllocation)}</p>
      <p className={styles.meta}>
        Fokus unit: {objective.focusUnits.join(", ")} · Area: {objective.areaPriorities.join(", ")}
      </p>
    </section>
  );
}
