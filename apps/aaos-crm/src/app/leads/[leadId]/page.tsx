import Link from "next/link";

import { LeadDetail } from "@/components/leads/LeadDetail";

/** Lead detail + real conversation history (spec "leads/[leadId]/page.tsx"). */
export default function LeadDetailPage({
  params,
}: {
  readonly params: { leadId: string };
}): React.ReactElement {
  return (
    <main>
      <div className="p-4 pb-0">
        <Link href="/leads" className="text-sm font-medium text-brand-primary">
          ← Kembali
        </Link>
      </div>
      <LeadDetail leadId={params.leadId} />
    </main>
  );
}
