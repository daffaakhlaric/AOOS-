import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import type { SalesHumanAccountDto } from "@/types/sales-human-account.types";

import styles from "./SalesTeamTable.module.css";

const STATUS_TONE: Readonly<Record<SalesHumanAccountDto["status"], StatusTone>> = {
  ON: "success",
  BUSY: "warning",
  OFF: "danger",
};

export interface SalesTeamTableProps {
  readonly team: readonly SalesHumanAccountDto[];
  /** "+ Tambah Sales Human" — rendered both as the empty-state's action and the list's footer button (Part 1's "Sales Team ... [+ Tambah Sales Human]" mockup). */
  readonly onAddSales?: () => void;
  readonly onEdit?: (salesHumanId: string) => void;
  readonly onResetPassword?: (salesHumanId: string) => void;
  /** "Nonaktif" — sets the real `status` column to `OFF` (coordinator note #1); never deletes the Supabase Auth user or the row. */
  readonly onDeactivate?: (salesHumanId: string) => void;
}

/** Real, Supabase-backed sales team accounts — status badges ON green, BUSY amber, OFF red (spec "components/branches/SalesTeamTable.tsx", AAOS-SALES-MGMT-CRM-AUTH real-auth wiring). */
export function SalesTeamTable({
  team,
  onAddSales,
  onEdit,
  onResetPassword,
  onDeactivate,
}: SalesTeamTableProps): React.ReactElement {
  const addButton =
    onAddSales !== undefined ? (
      <button type="button" onClick={onAddSales} className={styles.addButton}>
        + Tambah Sales Human
      </button>
    ) : undefined;

  if (team.length === 0) {
    return (
      <EmptyState
        title="Belum ada sales"
        description="Tambahkan sales untuk branch ini."
        action={addButton}
      />
    );
  }
  return (
    <div>
      <ul data-testid="sales-team-table" className={styles.list}>
        {team.map((sales) => (
          <li key={sales.id} className={styles.row}>
            <div className={styles.identity}>
              <span className={styles.name}>{sales.name}</span>
              <span className={styles.meta}>{sales.email ?? sales.phone}</span>
            </div>
            <StatusBadge label={sales.status} tone={STATUS_TONE[sales.status]} />
            <span className={styles.actions}>
              <button
                type="button"
                onClick={() => onEdit?.(sales.id)}
                className={styles.editButton}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onResetPassword?.(sales.id)}
                className={styles.resetButton}
              >
                Reset PW
              </button>
              <button
                type="button"
                onClick={() => onDeactivate?.(sales.id)}
                className={styles.removeButton}
              >
                Nonaktif
              </button>
            </span>
          </li>
        ))}
      </ul>
      {onAddSales !== undefined ? (
        <button type="button" onClick={onAddSales} className={styles.addButtonFooter}>
          + Tambah Sales Human
        </button>
      ) : null}
    </div>
  );
}
