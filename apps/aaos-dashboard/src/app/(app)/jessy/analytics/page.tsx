import { TopBar } from "@/components/layout/TopBar";
import { JessyAnalyticsClient } from "@/components/jessy/JessyAnalyticsClient";

/** `/jessy/analytics` — real KPIs computed from `@aos/lead-store` data (MENU RESTRUCTURE FINAL). */
export default function JessyAnalyticsPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Analytics" />
      <JessyAnalyticsClient />
    </main>
  );
}
