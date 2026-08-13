import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";

/** Supabase Auth login (spec "app/(auth)/login/page.tsx"). `LoginForm` uses `useSearchParams`, which requires a `Suspense` boundary. */
export default function LoginPage(): React.ReactElement {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
