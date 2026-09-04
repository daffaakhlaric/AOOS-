import { EmptyState } from "@/components/ui/EmptyState";
import { formatIdrCompact } from "@/lib/formatters";
import type { ClosingDto } from "@/types/dashboard.types";

import styles from "./ClosingsRecent.module.css";

const CLOSING_TYPE_LABEL: Readonly<Record<ClosingDto["closingType"], string>> = {
  TEST_DRIVE: "Test Drive",
  SPK: "SPK",
  CANCELLED: "Batal",
};

export interface ClosingsRecentProps {
  readonly closings: readonly ClosingDto[];
  /** `salesHumanId → name` lookup, built by `DashboardClient.tsx` from the real `GET /api/branches`
   * response (`BranchDto.team`) — falls back to showing the raw id when a closing's sales human
   * isn't found in any branch's team (never fabricates a name). */
  readonly salesNameById: Readonly<Record<string, string>>;
}

/**
 * "Closing Terbaru" — the 3 most recent real closings (FINAL UI REBUILD, reference screenshot:
 * unit · cabang · sales · komisi). `commissionIdr` is optional on `ClosingDto` (not every closing
 * — e.g. a `TEST_DRIVE` with no sale yet — has a commission), shown as "—" rather than "Rp 0" when
 * absent.
 */
export function ClosingsRecent({
  closings,
  salesNameById,
}: ClosingsRecentProps): React.ReactElement {
  const recent = closings
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  if (recent.length === 0) {
    return (
      <EmptyState title="Belum ada closing" description="Closing bulan ini akan muncul di sini." />
    );
  }

  return (
    <ul data-testid="closings-recent" className={styles.list}>
      {recent.map((closing) => (
        <li key={closing.id} className={styles.row}>
          <div className={styles.info}>
            <span className={styles.unit}>{closing.unitModel ?? closing.unitId ?? "—"}</span>
            <span className={styles.meta}>
              {closing.branchId} · {salesNameById[closing.salesHumanId] ?? closing.salesHumanId} ·{" "}
              {CLOSING_TYPE_LABEL[closing.closingType]}
            </span>
          </div>
          <span className={styles.commission}>
            {closing.commissionIdr !== undefined ? formatIdrCompact(closing.commissionIdr) : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}
