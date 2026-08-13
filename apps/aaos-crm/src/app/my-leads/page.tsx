import { MyLeadsClient } from "@/components/leads/MyLeadsClient";

/** Leads yang sudah di-claim (spec "/my-leads"). */
export default function MyLeadsPage(): React.ReactElement {
  return (
    <main>
      <MyLeadsClient />
    </main>
  );
}
