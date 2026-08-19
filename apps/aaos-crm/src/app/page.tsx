import { redirect } from "next/navigation";

/** `/` redirects to `/inbox`, the new main page (AAOS-SALES-MGMT-CRM-AUTH — `/leads` retired, coordinator note #2). */
export default function RootPage(): never {
  redirect("/inbox");
}
