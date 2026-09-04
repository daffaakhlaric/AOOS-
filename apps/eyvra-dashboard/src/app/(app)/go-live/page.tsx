import { TopBar } from "@/components/layout/TopBar";
import { GoLiveClient } from "@/components/go-live/GoLiveClient";

/** `/go-live` — Go Live Monitor (MENU RESTRUCTURE FINAL, coordinator note #5). See `GoLiveClient`'s docstring for why this always renders empty right now. */
export default function GoLivePage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Go Live Monitor" />
      <GoLiveClient />
    </main>
  );
}
