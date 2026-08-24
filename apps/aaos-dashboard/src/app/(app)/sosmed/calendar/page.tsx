import { TopBar } from "@/components/layout/TopBar";
import { ContentCalendarClient } from "@/components/sosmed/ContentCalendarClient";

/** `/sosmed/calendar` — Content Calendar (AAOS-SOSMED-AUTOMATION Phase 5, Page 2). */
export default function ContentCalendarPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Content Calendar" />
      <ContentCalendarClient />
    </main>
  );
}
