"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import styles from "./UserMenu.module.css";

export function UserMenu({ email }: { readonly email?: string }): React.ReactElement {
  const router = useRouter();
  const [resolvedEmail, setEmail] = useState(email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (email) return;
    const controller = new AbortController();
    fetch("/api/workspace", { signal: controller.signal })
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json();
          setEmail(data.email);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [email]);
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const { error: failure } = await createSupabaseBrowserClient().auth.signOut();
      if (failure) throw failure;
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Logout gagal. Silakan coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className={styles.menu}>
      <summary aria-label="Menu akun SkorPintar">
        <span className={styles.avatar}>{resolvedEmail?.slice(0, 2).toUpperCase() ?? "SP"}</span>
        <span>{resolvedEmail?.split("@")[0] ?? "Akun saya"}</span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className={styles.panel}>
        <strong>SkorPintar Ads Insight</strong>
        <Link href="/settings#profile">Profile</Link>
        <Link href="/settings#workspace">Workspace</Link>
        <Link href="/settings#integrations">Integrations</Link>
        <button type="button" disabled={busy} onClick={() => void logout()}>
          {busy ? "Keluar…" : "Logout"}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  );
}
