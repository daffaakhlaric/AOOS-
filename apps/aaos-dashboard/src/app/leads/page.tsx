import { TopBar } from "@/components/layout/TopBar";
import { LeadsClient } from "@/components/leads/LeadsClient";

/** All leads overview — manager view (spec "leads/page.tsx"). */
export default function LeadsPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Leads" />
      <LeadsClient />
    </main>
  );
}
