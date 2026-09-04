import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

import styles from "./page.module.css";

/** Supabase Auth login page (spec "app/(auth)/login/page.tsx"). */
export default function LoginPage(): React.ReactElement {
  return (
    <main className={styles.main}>
      <Suspense fallback={<LoadingSpinner />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
