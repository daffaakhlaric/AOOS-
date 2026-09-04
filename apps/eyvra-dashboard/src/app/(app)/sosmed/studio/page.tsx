import { TopBar } from "@/components/layout/TopBar";
import { ContentStudioClient } from "@/components/sosmed/ContentStudioClient";

/** `/sosmed/studio` — Content Studio (AAOS-SOSMED-AUTOMATION Phase 5, Page 3). */
export default function ContentStudioPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Content Studio" />
      <ContentStudioClient />
    </main>
  );
}
