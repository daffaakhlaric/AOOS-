import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import type { SalesHumanDto } from "@/types/dashboard.types";

import styles from "./SalesTeamTable.module.css";

const STATUS_TONE: Readonly<Record<SalesHumanDto["status"], StatusTone>> = {
  ON: "success",
  BUSY: "warning",
  OFF: "danger",
};

export interface SalesTeamTableProps {
  readonly team: readonly SalesHumanDto[];
  readonly onRemove?: (salesHumanId: string) => void;
  readonly onEdit?: (salesHumanId: string) => void;
}

/** Sales team table with status badges — ON green, BUSY amber, OFF red (spec "components/branches/SalesTeamTable.tsx"). */
export function SalesTeamTable({
  team,
  onRemove,
  onEdit,
}: SalesTeamTableProps): React.ReactElement {
  if (team.length === 0) {
    return <EmptyState title="Belum ada sales" description="Tambahkan sales untuk branch ini." />;
  }
  return (
    <ul data-testid="sales-team-table" className={styles.list}>
      {team.map((sales) => (
        <li key={sales.id} className={styles.row}>
          <span className={styles.name}>{sales.name}</span>
          <span className={styles.meta}>{sales.waNumber}</span>
          <StatusBadge label={sales.status} tone={STATUS_TONE[sales.status]} />
          <span className={styles.actions}>
            <button type="button" onClick={() => onEdit?.(sales.id)} className={styles.editButton}>
              Edit
            </button>
            <button
              type="button"
              onClick={() => onRemove?.(sales.id)}
              className={styles.removeButton}
            >
              Remove
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
