import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";

import styles from "./page.module.css";

export default function LoginPage(): React.ReactElement {
  return (
    <main className={styles.main}>
      <Suspense fallback={<p>Memuat...</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
