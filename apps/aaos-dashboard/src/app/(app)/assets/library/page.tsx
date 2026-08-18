import { AssetLibraryClient } from "@/components/assets/AssetLibraryClient";
import { TopBar } from "@/components/layout/TopBar";

/**
 * Asset Library page (`/assets/library`) — AAOS-SCRAPER-ASSET-LIBRARY. Reachable from the
 * OPERASIONAL sidebar group. All data flows through this app's own `/api/assets*` proxy routes.
 */
export default function AssetLibraryPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Asset Library" />
      <AssetLibraryClient />
    </main>
  );
}
