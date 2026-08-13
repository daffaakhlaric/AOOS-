import { StatsClient } from "@/components/stats/StatsClient";

/** Personal stats (spec "/stats"). */
export default function StatsPage(): React.ReactElement {
  return (
    <main>
      <StatsClient />
    </main>
  );
}
