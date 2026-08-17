import { EmptyState } from "@/components/ui/EmptyState";
import type { LeadDto } from "@/types/dashboard.types";

import styles from "./RecentHotLeads.module.css";

/**
 * Top 5 hot leads by score (FINAL UI REBUILD, matching the reference screenshot's "Hot Leads
 * Terbaru" — nama · cabang · score, sorted score DESC, not by recency). `lead.score` is a real
 * field on `LeadDto` (`aaos-api`'s real `GET /api/v1/leads` response), never fabricated here.
 */
export function RecentHotLeads({
  leads,
}: {
  readonly leads: readonly LeadDto[];
}): React.ReactElement {
  const hotLeads = leads
    .filter((lead) => lead.temperature === "HOT")
    .slice()
    .sort((a, b) => b.score - a.score)
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
          <span className={styles.branch}>{lead.branchId}</span>
          <span className={styles.score}>{lead.score}</span>
        </li>
      ))}
    </ul>
  );
}
