import { redirect } from "next/navigation";

/** EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9, "jessy/knowledge" equivalent) — `/clara/knowledge` retired into the new Leads hub's "knowledge-base" tab (real tab content is Sprint 2/3; real `KnowledgeClient` untouched). */
export default function KnowledgePage(): never {
  redirect("/leads?tab=knowledge-base");
}
