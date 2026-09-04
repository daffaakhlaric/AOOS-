import { TopBar } from "@/components/layout/TopBar";
import { AccountsClient } from "@/components/sosmed/AccountsClient";

/** `/sosmed/accounts` — Akun Terhubung (AAOS-SOSMED-AUTOMATION Phase 5, Page 6). */
export default function SosmedAccountsPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Akun Terhubung" />
      <AccountsClient />
    </main>
  );
}
