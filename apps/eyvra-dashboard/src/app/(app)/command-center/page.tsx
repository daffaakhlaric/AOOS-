import { CommandCenterClient } from "@/components/command-center/CommandCenterClient";
import { TopBar } from "@/components/layout/TopBar";

/**
 * `/command-center` — EYVRA SAMANTHA V2 + KAI V2 Phase 50 (PROMPT 68, first frontend phase). New
 * real landing page for the Sidebar's `Command Center` item — see `CommandCenterClient.tsx`'s own
 * doc for the full real-data-vs-honestly-omitted breakdown. Deliberately does NOT replace `/dashboard`
 * (which keeps rendering `AutomotiveOverview`/`OverviewMonitorClient` for every tenant exactly as
 * before — this is a new, additive route, not a repoint of an existing one).
 */
export default function CommandCenterPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Command Center" accentColor="var(--v2-menu-overview)" />
      <CommandCenterClient />
    </main>
  );
}
