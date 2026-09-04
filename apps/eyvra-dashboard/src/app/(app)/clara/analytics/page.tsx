import { TopBar } from "@/components/layout/TopBar";
import { ClaraAnalyticsClient } from "@/components/clara/ClaraAnalyticsClient";

/** `/clara/analytics` — real KPIs computed from `@aos/lead-store` data (MENU RESTRUCTURE FINAL). */
export default function ClaraAnalyticsPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Analytics" />
      <ClaraAnalyticsClient />
    </main>
  );
}
