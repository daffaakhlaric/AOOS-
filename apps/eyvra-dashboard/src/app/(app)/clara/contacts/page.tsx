import { redirect } from "next/navigation";

/** EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9, "jessy/contacts" equivalent) — `/clara/contacts` retired into the new Leads hub's "semua" tab (real tab content is Sprint 2/3; real `ContactsClient` untouched). */
export default function ClaraContactsPage(): never {
  redirect("/leads?tab=semua");
}
