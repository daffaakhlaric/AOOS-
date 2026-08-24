import { ConnectSalesClient } from "@/components/sosmed/ConnectSalesClient";

import styles from "../../../login/page.module.css";

/**
 * `/connect/sales/:token` (AAOS-SOSMED-AUTOMATION Phase 4/5) — a sales human's own un-authenticated
 * phone browser lands here after clicking the WhatsApp-shared connect link (Akun Terhubung page's
 * "+ Hubungkan Akun Sales" flow). Public path (`middleware.ts`'s `PUBLIC_PATHS`) — same convention
 * as `/auth/callback`: no AAOS session exists when this page loads, so it lives in the `(auth)`
 * route group (bare root layout, no `Sidebar`/`TopBar` app chrome) and reuses the login page's
 * centered-form CSS module rather than inventing a near-identical one.
 */
export default function ConnectSalesPage({
  params,
}: {
  readonly params: { token: string };
}): React.ReactElement {
  return (
    <main className={styles.main}>
      <ConnectSalesClient token={params.token} />
    </main>
  );
}
