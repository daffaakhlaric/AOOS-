import { redirect } from "next/navigation";

/** EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9) — `/meta-ads/simulasi` ("Simulasi Samantha × Kai × Clara") retired into the new Aktivitas hub (real tab content is Sprint 2/3; real `SimulationWizardClient` untouched). */
export default function SimulasiPage(): never {
  redirect("/activity");
}
