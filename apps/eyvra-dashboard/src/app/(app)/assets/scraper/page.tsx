import { ScraperClient } from "@/components/assets/ScraperClient";
import { TopBar } from "@/components/layout/TopBar";

/**
 * Scraper Mobix page (`/assets/scraper`) — AAOS-SCRAPER-ASSET-LIBRARY. Reachable from the
 * OPERASIONAL sidebar group. All data flows through this app's own `/api/scraper/*` proxy routes.
 */
export default function ScraperPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Scraper Mobix" />
      <ScraperClient />
    </main>
  );
}
