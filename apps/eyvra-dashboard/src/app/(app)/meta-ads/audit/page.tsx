import { TopBar } from "@/components/layout/TopBar";
import { AuditClient } from "@/components/meta-ads/AuditClient";

/** Audit Biaya page (spec `meta-ads/audit/page.tsx`, AAOS-SAMANTHA-PAGES redesign). */
export default function AuditPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Audit Biaya" accentColor="var(--v2-menu-campaigns)" />
      <AuditClient />
    </main>
  );
}
