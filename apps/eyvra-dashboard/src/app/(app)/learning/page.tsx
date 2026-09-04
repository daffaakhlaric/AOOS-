import { redirect } from "next/navigation";

/** EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9, "learning-monitor/" equivalent) — `/learning` retired into the new AI Improve hub (real tab content is Sprint 2/3; real `LearningMonitorClient` untouched). */
export default function LearningPage(): never {
  redirect("/self-improve");
}
