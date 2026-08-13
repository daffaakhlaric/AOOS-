import { redirect } from "next/navigation";

/** `/` redirects to `/leads`, the main page (spec "page.tsx — redirect → /leads"). */
export default function RootPage(): never {
  redirect("/leads");
}
