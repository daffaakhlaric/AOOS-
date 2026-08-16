import { StatusBadge } from "@/components/ui/StatusBadge";
import type { BranchDto } from "@/types/dashboard.types";

import styles from "./BranchCard.module.css";

/** Branch summary card (spec "components/branches/BranchCard.tsx"). */
export function BranchCard({ branch }: { readonly branch: BranchDto }): React.ReactElement {
  return (
    <section data-testid="branch-card" className={styles.section}>
      <div className={styles.headerRow}>
        <p className={styles.name}>{branch.displayName}</p>
        <StatusBadge
          label={branch.active ? "Active" : "Inactive"}
          tone={branch.active ? "success" : "neutral"}
        />
      </div>
      <p className={styles.meta}>
        Nomor Jessy: {branch.wabaPhoneNumber} · {branch.availableCount} sales tersedia
      </p>
    </section>
  );
}
