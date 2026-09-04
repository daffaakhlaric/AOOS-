import { SuperadminClient } from "@/components/superadmin/SuperadminClient";

/** Super Admin dashboard (Part 1) — middleware-gated to a real `role === 'superadmin'` session. No `Sidebar`/`TopBar` tenant chrome — this is a separate panel, not part of the tenant app. */
export default function SuperadminPage(): React.ReactElement {
  return <SuperadminClient />;
}
