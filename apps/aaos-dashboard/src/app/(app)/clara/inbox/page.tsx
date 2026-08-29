import { TopBar } from "@/components/layout/TopBar";
import { ClaraInboxClient } from "@/components/clara/ClaraInboxClient";

/**
 * `/clara/inbox` — 3-panel Chatwoot-style inbox (MENU RESTRUCTURE FINAL, coordinator note #2).
 * Fully replaces the retired `/leads/[leadId]` split-panel chat room + the flat `/leads` list's
 * "Lihat Chat →" links — the ONLY live chat UI in this app now.
 */
export default function ClaraInboxPage({
  searchParams,
}: {
  readonly searchParams: { readonly lead?: string };
}): React.ReactElement {
  return (
    <main>
      <TopBar title="Inbox" />
      <ClaraInboxClient initialLeadId={searchParams.lead} />
    </main>
  );
}
