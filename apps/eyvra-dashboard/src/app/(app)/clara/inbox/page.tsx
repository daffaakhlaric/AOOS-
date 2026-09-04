import { redirect } from "next/navigation";

/** EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9, "jessy/inbox" equivalent) — `/clara/inbox` retired into the new Leads hub (real tab content is Sprint 2/3; real `ClaraInboxClient` untouched). */
export default function ClaraInboxPage(): never {
  redirect("/leads");
}
