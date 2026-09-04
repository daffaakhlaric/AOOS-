"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { createSupabaseBrowserClient } from "@/lib/supabase";

import styles from "./LoginForm.module.css";

/**
 * `/superadmin/login` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Part 1) — coordinator note #1: reuses
 * the EXACT SAME `supabase.auth.signInWithPassword` flow as `LoginForm.tsx`'s tenant login,
 * against the same Supabase project, then checks `role === 'superadmin'` on the returned user's
 * `user_metadata` — no second parallel sign-in mechanism, no plaintext env-var password compared
 * server-side. A successful sign-in whose role is NOT `superadmin` is immediately signed back out
 * (never leaves a non-superadmin session sitting on `/superadmin/login`) and shown an honest
 * error, rather than silently redirecting somewhere unexpected.
 */
export function SuperadminLoginForm(): React.ReactElement {
  const router = useRouter();
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
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      const role = (data.user?.user_metadata as Record<string, unknown> | undefined)?.["role"];
      if (role !== "superadmin") {
        await supabase.auth.signOut();
        setError("Akun ini bukan akun Super Admin.");
        return;
      }
      router.push("/superadmin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal masuk. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>⚡ AAOS Super Admin</h1>
      <p className={styles.subtitle}>Khusus untuk Super Admin AAOS.</p>
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
