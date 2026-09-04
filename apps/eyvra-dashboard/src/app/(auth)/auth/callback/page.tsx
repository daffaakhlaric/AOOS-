import { AuthCallbackClient } from "@/components/auth/AuthCallbackClient";

import styles from "../../login/page.module.css";

/** Completes an impersonation magic-link sign-in (see `AuthCallbackClient`'s docstring). Public path (`middleware.ts`'s `PUBLIC_PATHS`) — no session exists yet when Supabase redirects here. */
export default function AuthCallbackPage(): React.ReactElement {
  return (
    <main className={styles.main}>
      <AuthCallbackClient />
    </main>
  );
}
