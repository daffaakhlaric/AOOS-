import { TopBar } from "@/components/layout/TopBar";
import { AuditClient } from "@/components/meta-ads/AuditClient";

/** Audit Biaya page (spec `meta-ads/audit/page.tsx`, AAOS-TAMARA-PAGES redesign). */
export default function AuditPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Audit Biaya" />
      <AuditClient />
    </main>
  );
}
