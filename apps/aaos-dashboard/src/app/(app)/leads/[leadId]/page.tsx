import Link from "next/link";

import { TopBar } from "@/components/layout/TopBar";
import { LeadChatRoom } from "@/components/leads/LeadChatRoom";

/** `/leads/[leadId]` — manager chat room (AAOS-CHAT-ROOM-JESSY "Page 1"). Genuinely new: `apps/aaos-dashboard` previously had no `leads/[leadId]` route, only the list. */
export default function LeadChatRoomPage({
  params,
}: {
  readonly params: { leadId: string };
}): React.ReactElement {
  return (
    <main>
      <TopBar title="Chat Room" />
      <div style={{ padding: "16px 32px 0" }}>
        <Link href="/leads" style={{ fontSize: "13px", fontWeight: 600, color: "var(--blue)" }}>
          ← Kembali ke Leads
        </Link>
      </div>
      <LeadChatRoom leadId={params.leadId} />
    </main>
  );
}
