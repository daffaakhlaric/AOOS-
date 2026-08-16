import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeTimeId } from "@/lib/formatters";
import type { LeadDto } from "@/types/dashboard.types";

import styles from "./RecentHotLeads.module.css";

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
    <ul data-testid="recent-hot-leads" className={styles.list}>
      {hotLeads.map((lead) => (
        <li key={lead.id} className={styles.row}>
          <span className={styles.name}>{lead.leadName ?? lead.leadPhone}</span>
          <span className={styles.meta}>{lead.branchId}</span>
          <span className={styles.meta}>{formatRelativeTimeId(lead.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
