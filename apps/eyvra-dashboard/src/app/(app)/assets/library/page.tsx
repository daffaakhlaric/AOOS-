import { redirect } from "next/navigation";

/** EYVRA MENU RESTRUCTURE Sprint 1 (PROMPT 9) — `/assets/library` ("Asset Library") retired into the new Creative hub's "assets" tab (real tab content is Sprint 2/3; real `AssetLibraryClient` untouched). */
export default function AssetLibraryPage(): never {
  redirect("/creative?tab=assets");
}
