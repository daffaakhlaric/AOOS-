import { redirect } from "next/navigation";

/** EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9, "jessy/simulator" equivalent) — `/clara/simulator` retired into the new Aktivitas hub (real tab content is Sprint 2/3; the real "open apps/aaos-simulator" link previously here is untouched in git history, not deleted). */
export default function SimulatorPage(): never {
  redirect("/activity");
}
