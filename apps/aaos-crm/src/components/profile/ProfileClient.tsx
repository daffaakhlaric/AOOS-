"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useSalesSession } from "@/lib/session";
import type { SalesHumanAccountDto } from "@/types/crm.types";

const STATUS_OPTIONS: readonly SalesHumanAccountDto["status"][] = ["ON", "BUSY", "OFF"];
const STATUS_LABEL: Readonly<Record<SalesHumanAccountDto["status"], string>> = {
  ON: "🟢 Aktif",
  BUSY: "🟡 Sibuk",
  OFF: "⚫ Nonaktif",
};
const MIN_PASSWORD_LENGTH = 8;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * `/profile` (AAOS-SALES-MGMT-CRM-AUTH Part 8, genuinely new — no such route existed before this
 * task). Three cards per spec: "Profil Saya" (name/phone, self-service `PUT
 * /api/sales-humans/:id`), "Keamanan" (password change — re-authenticates with the OLD password
 * via `signInWithPassword` before calling `supabase.auth.updateUser`, coordinator note #1's
 * explicit "honestly fail if that re-auth fails" requirement, never skipped), and "Status
 * Kehadiran" (ON/BUSY/OFF toggle against the real `status` column).
 */
export function ProfileClient(): React.ReactElement {
  const { session, loading: sessionLoading } = useSalesSession();
  const [account, setAccount] = useState<SalesHumanAccountDto | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | undefined>(undefined);
  const [profileSaved, setProfileSaved] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [statusSaving, setStatusSaving] = useState(false);

  function load(): void {
    if (session === undefined) {
      return;
    }
    fetch(`/api/sales-humans/${encodeURIComponent(session.salesHumanId)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat profil.");
        }
        return (await res.json()) as SalesHumanAccountDto;
      })
      .then((data) => {
        setAccount(data);
        setName(data.name);
        setPhone(data.phone);
      })
      .catch((caught: unknown) => {
        setLoadError(caught instanceof Error ? caught.message : "Gagal memuat profil.");
      });
  }

  useEffect(load, [session]);

  async function handleSaveProfile(): Promise<void> {
    if (session === undefined) {
      return;
    }
    if (name.trim().length === 0) {
      setProfileError("Nama lengkap wajib diisi.");
      return;
    }
    setProfileSaving(true);
    setProfileError(undefined);
    setProfileSaved(false);
    try {
      const response = await fetch(
        `/api/sales-humans/${encodeURIComponent(session.salesHumanId)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, phone }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal menyimpan profil.");
      }
      const updated = (await response.json()) as SalesHumanAccountDto;
      setAccount(updated);
      setProfileSaved(true);
    } catch (caught) {
      setProfileError(caught instanceof Error ? caught.message : "Gagal menyimpan profil.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword(): Promise<void> {
    if (session?.email === undefined) {
      setPasswordError("Email tidak ditemukan pada sesi ini.");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Password baru minimal ${String(MIN_PASSWORD_LENGTH)} karakter.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Konfirmasi password tidak cocok.");
      return;
    }
    setPasswordSaving(true);
    setPasswordError(undefined);
    setPasswordSaved(false);
    try {
      const supabase = createSupabaseBrowserClient();
      // Re-authenticate with the OLD password first — Supabase's client-side `updateUser` has no
      // built-in old-password check, so this is the real verification step (coordinator note #1:
      // "should honestly report failure if that re-auth fails, never silently skip the check").
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: session.email,
        password: oldPassword,
      });
      if (reauthError !== null) {
        setPasswordError("Password lama salah.");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError !== null) {
        setPasswordError(updateError.message);
        return;
      }
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
    } catch (caught) {
      setPasswordError(caught instanceof Error ? caught.message : "Gagal mengubah password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleStatusChange(status: SalesHumanAccountDto["status"]): Promise<void> {
    if (session === undefined || account === undefined || status === account.status) {
      return;
    }
    setStatusSaving(true);
    try {
      const response = await fetch(
        `/api/sales-humans/${encodeURIComponent(session.salesHumanId)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (response.ok) {
        const updated = (await response.json()) as SalesHumanAccountDto;
        setAccount(updated);
      }
    } finally {
      setStatusSaving(false);
    }
  }

  if (sessionLoading) {
    return <LoadingSpinner />;
  }
  if (session === undefined) {
    return <EmptyState title="Belum masuk" description="Silakan masuk untuk melihat profil." />;
  }
  if (loadError !== undefined) {
    return <ErrorCard message={loadError} />;
  }
  if (account === undefined) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-ink">👤 Profil Saya</h1>

      <section className="rounded-card border border-hairline bg-surface-card p-4 shadow-card">
        <h2 className="mb-1 text-sm font-semibold text-ink">Profil Saya</h2>
        <p className="mb-3 text-xs text-ink-muted">
          Cabang: {account.branchId} · Bergabung {formatDate(account.createdAt)}
        </p>

        <label className="mb-3 block text-xs font-medium text-ink-muted">
          Nama Lengkap
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-button border border-hairline px-3 py-2 text-sm text-ink"
          />
        </label>

        <label className="mb-1 block text-xs font-medium text-ink-muted">
          Email
          <input
            value={account.email ?? ""}
            disabled
            className="mt-1 w-full rounded-button border border-hairline bg-surface-page px-3 py-2 text-sm text-ink-muted"
          />
        </label>
        <p className="mb-3 text-[11px] text-ink-muted">
          Ubah email melalui manager (Branch Settings).
        </p>

        <label className="mb-3 block text-xs font-medium text-ink-muted">
          Nomor HP
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-button border border-hairline px-3 py-2 text-sm text-ink"
          />
        </label>

        {profileError !== undefined ? (
          <p className="mb-2 text-xs text-brand-danger">{profileError}</p>
        ) : null}
        {profileSaved ? <p className="mb-2 text-xs text-brand-success">Profil disimpan.</p> : null}

        <button
          type="button"
          onClick={() => void handleSaveProfile()}
          disabled={profileSaving}
          className="rounded-button bg-brand-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {profileSaving ? "Menyimpan..." : "Simpan Profil"}
        </button>
      </section>

      <section className="rounded-card border border-hairline bg-surface-card p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-ink">Keamanan</h2>

        <label className="mb-3 block text-xs font-medium text-ink-muted">
          Password Lama
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="mt-1 w-full rounded-button border border-hairline px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="mb-3 block text-xs font-medium text-ink-muted">
          Password Baru
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded-button border border-hairline px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="mb-3 block text-xs font-medium text-ink-muted">
          Konfirmasi Password Baru
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded-button border border-hairline px-3 py-2 text-sm text-ink"
          />
        </label>

        {passwordError !== undefined ? (
          <p className="mb-2 text-xs text-brand-danger">{passwordError}</p>
        ) : null}
        {passwordSaved ? (
          <p className="mb-2 text-xs text-brand-success">Password berhasil diubah.</p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleChangePassword()}
          disabled={passwordSaving}
          className="rounded-button bg-brand-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {passwordSaving ? "Menyimpan..." : "Ubah Password"}
        </button>
      </section>

      <section className="rounded-card border border-hairline bg-surface-card p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-ink">Status Kehadiran</h2>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => void handleStatusChange(status)}
              disabled={statusSaving}
              className={`rounded-button border px-3 py-2 text-xs font-semibold disabled:opacity-60 ${
                account.status === status
                  ? "border-brand-primary bg-brand-primary text-white"
                  : "border-hairline text-ink"
              }`}
            >
              {STATUS_LABEL[status]}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
