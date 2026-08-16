"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { createSupabaseBrowserClient } from "@/lib/supabase";

import styles from "./LoginForm.module.css";

const DEFAULT_REDIRECT = "/dashboard";

/**
 * Resolves the post-login redirect target from the `redirectedFrom` query param, guarding against
 * two failure modes: (1) an absolute/protocol-relative URL (`https://evil.example`, `//evil`),
 * which would be an open redirect if used unchecked — only a same-origin path starting with a
 * single `/` is accepted; (2) `redirectedFrom` pointing back at `/login` itself, which previously
 * could chain into a pathological self-redirect if middleware ever redirected there again.
 */
function resolveRedirectTarget(raw: string | null): string {
  if (raw === null || !raw.startsWith("/") || raw.startsWith("//")) {
    return DEFAULT_REDIRECT;
  }
  if (raw === "/login" || raw.startsWith("/login/") || raw.startsWith("/login?")) {
    return DEFAULT_REDIRECT;
  }
  return raw;
}

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
      const redirectedFrom = resolveRedirectTarget(searchParams.get("redirectedFrom"));
      router.push(redirectedFrom);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal masuk. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Masuk ke AAOS Dashboard</h1>
      <p className={styles.subtitle}>Untuk manager/owner DSS Motor.</p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <label className={styles.field}>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={styles.input}
          />
        </label>
        <label className={styles.field}>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={styles.input}
          />
        </label>
        {error !== undefined ? <ErrorCard message={error} /> : null}
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Memproses..." : "Masuk"}
        </button>
      </form>
    </div>
  );
}
