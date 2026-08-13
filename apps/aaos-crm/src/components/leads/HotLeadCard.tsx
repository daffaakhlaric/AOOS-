import Link from "next/link";

import { formatRelativeTimeId } from "@/lib/formatters";
import type { LeadDto } from "@/types/crm.types";

import { ClaimButton } from "./ClaimButton";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { QualificationBadges } from "./QualificationBadges";

export interface HotLeadCardProps {
  readonly lead: LeadDto;
  readonly salesHumanId: string;
  readonly onClaimed?: (leadId: string) => void;
}

/** One hot lead card in the inbox (spec mockup: "🔥 Pak Andi · 2 menit lalu · NEW · [Claim Lead →]"). */
export function HotLeadCard({
  lead,
  salesHumanId,
  onClaimed,
}: HotLeadCardProps): React.ReactElement {
  const isUnclaimed = lead.assignedSalesId === undefined;
  return (
    <li
      data-testid="hot-lead-card"
      className="rounded-card border border-hairline bg-surface-card p-4 shadow-card"
    >
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/leads/${lead.id}`}
          className="font-semibold text-ink hover:text-brand-primary"
        >
          🔥 {lead.leadName ?? lead.leadPhone}
        </Link>
        <LeadStatusBadge status={lead.status} />
      </div>
      <p className="mt-0.5 text-xs text-ink-muted">
        {formatRelativeTimeId(lead.createdAt)} · Skor {lead.score} · {lead.branchId}
      </p>
      <div className="mt-2">
        <QualificationBadges qualification={lead.qualification} />
      </div>
      <div className="mt-3">
        {isUnclaimed ? (
          <ClaimButton
            leadId={lead.id}
            salesHumanId={salesHumanId}
            onClaimed={() => onClaimed?.(lead.id)}
          />
        ) : (
          <span data-testid="already-claimed" className="text-sm font-medium text-ink-muted">
            Diklaim {lead.assignedSalesId}
          </span>
        )}
      </div>
    </li>
  );
}
