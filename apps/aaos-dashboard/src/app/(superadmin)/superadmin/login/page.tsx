import { SuperadminLoginForm } from "@/components/auth/SuperadminLoginForm";

import styles from "./page.module.css";

/** Super Admin sign-in (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Part 1) — reuses `(auth)/login`'s own bare centered-form layout styling (`page.module.css`), no Sidebar/TopBar chrome, same as the tenant login page. */
export default function SuperadminLoginPage(): React.ReactElement {
  return (
    <main className={styles.main}>
      <SuperadminLoginForm />
    </main>
  );
}
