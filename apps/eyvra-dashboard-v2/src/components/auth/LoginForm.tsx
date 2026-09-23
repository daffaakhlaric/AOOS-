"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase";

import styles from "./LoginForm.module.css";

const DEFAULT_REDIRECT = "/command-center";

function resolveRedirectTarget(raw: string | null): string {
  if (raw === null || !raw.startsWith("/") || raw.startsWith("//")) {
    return DEFAULT_REDIRECT;
  }
  if (raw === "/login" || raw.startsWith("/login/") || raw.startsWith("/login?")) {
    return DEFAULT_REDIRECT;
  }
  return raw;
}

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
      router.push(resolveRedirectTarget(searchParams.get("redirectedFrom")));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal masuk. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.wordmark}>EYVRA</div>
      <h1 className={styles.title}>Masuk ke Command Center</h1>
      <p className={styles.subtitle}>Untuk manager/owner tenant.</p>
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
        {error !== undefined ? <p className={styles.error}>{error}</p> : null}
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Memproses..." : "Masuk"}
        </button>
      </form>
    </div>
  );
}
