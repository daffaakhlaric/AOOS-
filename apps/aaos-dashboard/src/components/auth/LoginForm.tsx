"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { createSupabaseBrowserClient } from "@/lib/supabase";

/** Supabase Auth login form (spec "app/(auth)/login/page.tsx"). Split from `page.tsx` so `useSearchParams` (which requires a Suspense boundary in a static-exported page) is isolated to this client component. */
export function LoginForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      const redirectedFrom = searchParams.get("redirectedFrom") ?? "/dashboard";
      router.push(redirectedFrom);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal masuk. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-card border border-hairline bg-surface-card p-6 shadow-card">
      <h1 className="text-lg font-semibold text-ink">Masuk ke AAOS Dashboard</h1>
      <p className="mt-1 text-sm text-ink-muted">Untuk manager/owner DSS Motor.</p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-button border border-hairline px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-button border border-hairline px-3 py-2"
          />
        </label>
        {error !== undefined ? <ErrorCard message={error} /> : null}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-button bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Memproses..." : "Masuk"}
        </button>
      </form>
    </div>
  );
}
