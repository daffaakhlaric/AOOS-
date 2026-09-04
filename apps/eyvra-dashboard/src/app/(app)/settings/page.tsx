import { SettingsHubClient } from "@/components/settings/SettingsHubClient";

/**
 * EYVRA MENU RESTRUCTURE Sprint 3 (PROMPT 8) — real "Settings" hub: Objective/Jadwal/Lokasi/
 * Koneksi/Agen tabs. `?tab=` matches the real `?tab=objective` deep link `/objective` and
 * `/campaigns?tab=objective` already point real users toward for Objective. See
 * `SettingsHubClient.tsx`'s own doc for the full real-component-reuse mapping and honest gaps
 * (Jadwal/Lokasi/per-agent toggles have no real backing anywhere in this codebase).
 */
export default function SettingsPage({
  searchParams,
}: {
  readonly searchParams: { readonly tab?: string };
}): React.ReactElement {
  return <SettingsHubClient initialTab={searchParams.tab} />;
}
