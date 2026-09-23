import { redirect } from "next/navigation";

/** `/` redirects to `/command-center` — the default authenticated landing route for this app (mirrors apps/eyvra-dashboard's own `/` -> `/dashboard` convention, redirect target changed to this app's own real landing page). */
export default function RootPage(): never {
  redirect("/command-center");
}
