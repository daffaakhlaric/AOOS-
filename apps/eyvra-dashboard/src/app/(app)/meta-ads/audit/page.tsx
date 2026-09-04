import { redirect } from "next/navigation";

/** EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9) — `/meta-ads/audit` ("Audit Biaya") retired into the new Campaign hub's "anggaran" tab (real tab content is Sprint 2/3; real `AuditClient` untouched). */
export default function AuditPage(): never {
  redirect("/campaigns?tab=anggaran");
}
