import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/common/Card";
import { Topbar } from "@/components/layout/Topbar";
const sections: Record<string, string> = {
  campaigns: "Campaigns",
  leads: "Leads",
  "kai-studio": "Kai Studio",
  experiments: "Experiments",
  automation: "Automation",
  activity: "Activity",
  settings: "Settings",
  "growth-objectives": "Growth Objectives",
};
export default function Placeholder({
  params,
}: {
  readonly params: { readonly section: string };
}): React.ReactElement {
  const title = sections[params.section];
  if (!title) notFound();
  return (
    <main>
      <Topbar title={title} />
      <div style={{ padding: 24 }}>
        <Card title="Coming in V2">
          <p>This workspace is being prepared. The Command Center is available now.</p>
          <Link
            href="/command-center"
            style={{ color: "var(--brand)", display: "inline-block", marginTop: 16 }}
          >
            Return to Command Center →
          </Link>
        </Card>
      </div>
    </main>
  );
}
