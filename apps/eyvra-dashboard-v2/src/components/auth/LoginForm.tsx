"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
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
      const workspace = await fetch("/api/auth/workspace", { cache: "no-store" });
      if (!workspace.ok) {
        const result = await workspace.json().catch(() => ({}));
        setError(
          result.message ?? "Akses workspace belum tersedia. Hubungi administrator workspace.",
        );
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
      <div className={styles.wordmark}>
        <BrandLogo />
      </div>
      <h1 className={styles.title}>Selamat Datang Kembali</h1>
      <p className={styles.subtitle}>
        Masuk ke SkorPintar Ads Insight untuk mengelola campaign dan keputusan iklan Anda.
      </p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <label className={styles.field}>
          Email
          <input
            type="email"
            autoComplete="email"
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={styles.input}
          />
        </label>
        {error !== undefined ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={submitting} className={styles.submitButton}>
          {submitting ? "Memproses..." : "Masuk"}
        </button>
      </form>
      <p className={styles.subtitle}>
        Belum punya akun? <Link href="/register">Mulai dengan SkorPintar</Link>
      </p>
    </div>
  );
}
