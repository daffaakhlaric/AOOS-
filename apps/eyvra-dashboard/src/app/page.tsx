import { redirect } from "next/navigation";

/** `/` redirects to `/dashboard` (spec "app/page.tsx"). */
export default function RootPage(): never {
  redirect("/dashboard");
}
