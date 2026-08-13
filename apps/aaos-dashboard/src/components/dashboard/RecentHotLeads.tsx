import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeTimeId } from "@/lib/formatters";
import type { LeadDto } from "@/types/dashboard.types";

/** Last 5 hot leads (spec "dashboard/page.tsx" mockup: "Pak Andi · Xpander · Cinere · 14 menit lalu"). */
export function RecentHotLeads({
  leads,
}: {
  readonly leads: readonly LeadDto[];
}): React.ReactElement {
  const hotLeads = leads
    .filter((lead) => lead.temperature === "HOT")
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  if (hotLeads.length === 0) {
    return (
      <EmptyState title="Belum ada hot lead" description="Hot lead terbaru akan muncul di sini." />
    );
  }

  return (
    <ul data-testid="recent-hot-leads" className="divide-y divide-hairline">
      {hotLeads.map((lead) => (
        <li key={lead.id} className="flex items-center justify-between py-2 text-sm">
          <span className="font-medium text-ink">{lead.leadName ?? lead.leadPhone}</span>
          <span className="text-ink-muted">{lead.branchId}</span>
          <span className="text-ink-muted">{formatRelativeTimeId(lead.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
