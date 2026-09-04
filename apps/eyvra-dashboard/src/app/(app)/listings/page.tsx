import { redirect } from "next/navigation";

/** EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9) — `/listings` ("Listing Manager") retired into the new Creative hub's "listing" tab (real tab content is Sprint 2/3; real `ListingsClient` untouched). */
export default function ListingsPage(): never {
  redirect("/creative?tab=listing");
}
