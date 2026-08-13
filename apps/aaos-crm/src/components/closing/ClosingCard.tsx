import { formatIdr } from "@/lib/formatters";
import type { ClosingDto } from "@/types/crm.types";

const LABEL: Record<string, string> = {
  TEST_DRIVE: "Test Drive",
  SPK: "SPK",
  CANCELLED: "Batal",
};

export interface ClosingCardProps {
  readonly closing: ClosingDto;
}

/** One closing record display (spec "components/closing/ClosingCard.tsx" — mockup "Pak Budi · Xpander · SPK · Rp 5.85jt komisi"). */
export function ClosingCard({ closing }: ClosingCardProps): React.ReactElement {
  return (
    <li
      data-testid="closing-card"
      className="rounded-card border border-hairline bg-surface-card p-4 shadow-card"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-ink">{closing.unitModel ?? "Unit tidak diisi"}</span>
        <span className="text-xs font-semibold text-brand-primary">
          {LABEL[closing.closingType] ?? closing.closingType}
        </span>
      </div>
      {closing.commissionIdr !== undefined ? (
        <p className="mt-1 text-sm text-ink-muted">Komisi {formatIdr(closing.commissionIdr)}</p>
      ) : null}
      {closing.notes !== undefined ? (
        <p className="mt-1 text-sm text-ink-muted">{closing.notes}</p>
      ) : null}
    </li>
  );
}
