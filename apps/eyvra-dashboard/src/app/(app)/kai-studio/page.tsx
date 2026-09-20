import { KaiStudioClient } from "@/components/creative/KaiStudioClient";
import { TopBar } from "@/components/layout/TopBar";

/**
 * `/kai-studio` — EYVRA SAMANTHA V2 + KAI V2 Phase 52 (PROMPT 85/86/87/88/89). New real dedicated
 * page for the Sidebar's "Kai Studio" item, replacing its previous Phase 50 placeholder repoint at
 * `/creative` — see `KaiStudioClient.tsx`'s own doc for the full real-column-by-column breakdown
 * (Samantha Brief / Creative Concepts grid / Inspector) and the honest stepper simplification.
 * `/creative`'s own 6-tab hub (`CreativeHubClient`) is untouched and still reachable from its own
 * nav precedent (e.g. the Listing Manager's "Brief Kai" links) — this is an additive, campaign-
 * scoped workspace view, not a replacement for that review queue.
 */
export default function KaiStudioPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Kai Studio" accentColor="var(--v2-menu-creative)" />
      <KaiStudioClient />
    </main>
  );
}
