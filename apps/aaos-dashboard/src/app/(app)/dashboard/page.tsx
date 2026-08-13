import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { TopBar } from "@/components/layout/TopBar";

/** Dashboard overview / home (spec "dashboard/page.tsx"). */
export default function DashboardPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Overview" />
      <DashboardClient />
    </main>
  );
}
