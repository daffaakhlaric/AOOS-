import { PlaceholderPage } from "@/components/layout/PlaceholderPage";

/**
 * EYVRA MENU RESTRUCTURE Sprint 1 — new "Aktivitas" hub (spec PROMPT 2: "gabungan semua
 * activity" — merges the real `/property/activity` Activity Log page, `/go-live` Go Live
 * Monitor, `/meta-ads/simulasi` Simulasi, and `/clara/simulator` Simulator into one route).
 * Placeholder only this sprint — real tab content is Sprint 2/3.
 */
export default function ActivityPage(): React.ReactElement {
  return (
    <PlaceholderPage
      title="Aktivitas"
      description="Activity log, Go Live Monitor, dan simulasi Samantha × Kai × Clara akan digabung ke sini."
    />
  );
}
