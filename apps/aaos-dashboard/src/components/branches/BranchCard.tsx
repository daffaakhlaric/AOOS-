import { StatusBadge } from "@/components/ui/StatusBadge";
import type { BranchDto } from "@/types/dashboard.types";

/** Branch summary card (spec "components/branches/BranchCard.tsx"). */
export function BranchCard({ branch }: { readonly branch: BranchDto }): React.ReactElement {
  return (
    <section
      data-testid="branch-card"
      className="rounded-card border border-hairline bg-surface-card p-4 shadow-card"
    >
      <div className="flex items-center justify-between">
        <p className="font-semibold text-ink">{branch.displayName}</p>
        <StatusBadge
          label={branch.active ? "Active" : "Inactive"}
          tone={branch.active ? "success" : "neutral"}
        />
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Nomor Jessy: {branch.wabaPhoneNumber} · {branch.availableCount} sales tersedia
      </p>
    </section>
  );
}
