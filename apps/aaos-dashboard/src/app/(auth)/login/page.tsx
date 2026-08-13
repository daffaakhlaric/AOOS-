import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

/** Supabase Auth login page (spec "app/(auth)/login/page.tsx"). */
export default function LoginPage(): React.ReactElement {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense fallback={<LoadingSpinner />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
