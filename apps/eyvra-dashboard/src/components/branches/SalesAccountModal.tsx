"use client";

import { useState } from "react";

import type { SalesHumanAccountDto } from "@/types/sales-human-account.types";

import styles from "./SalesAccountModal.module.css";

export interface SalesAccountModalProps {
  readonly branchId: string;
  /** `undefined` = Add mode (Part 1's Add Sales Modal); a real account = Edit mode ("Nama + Email + HP bisa diubah", "Password kosong = tidak berubah"). */
  readonly editing?: SalesHumanAccountDto;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

/** Add/Edit Sales Human modal (spec Part 1) — real `POST`/`PUT /api/v1/sales-humans` via `apps/eyvra-dashboard`'s own proxy routes, never a client-side bcrypt/JWT call (coordinator note #1). */
export function SalesAccountModal({
  branchId,
  editing,
  onClose,
  onSaved,
}: SalesAccountModalProps): React.ReactElement {
  const isEdit = editing !== undefined;
  const [name, setName] = useState(editing?.name ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [status, setStatus] = useState<SalesHumanAccountDto["status"]>(editing?.status ?? "ON");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  function validate(): string | undefined {
    if (name.trim().length === 0) {
      return "Nama lengkap wajib diisi.";
    }
    if (!isEdit && email.trim().length === 0) {
      return "Email wajib diisi.";
    }
    // Edit mode: an empty password means "tidak berubah" (spec) — only validate length when the
    // manager actually typed one. Add mode: password is always required.
    const passwordProvided = !isEdit || password.length > 0;
    if (passwordProvided && password.length < MIN_PASSWORD_LENGTH) {
      return `Password minimal ${String(MIN_PASSWORD_LENGTH)} karakter.`;
    }
    if (password !== confirmPassword) {
      return "Konfirmasi password tidak cocok.";
    }
    return undefined;
  }

  async function handleSave(): Promise<void> {
    const validationError = validate();
    if (validationError !== undefined) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const url = isEdit
        ? `/api/sales-humans/${encodeURIComponent(editing.id)}`
        : "/api/sales-humans";
      const body = isEdit
        ? {
            name,
            phone: phone.length > 0 ? phone : undefined,
            status,
            ...(email !== editing.email ? { email } : {}),
            ...(password.length > 0 ? { password } : {}),
          }
        : {
            name,
            email,
            password,
            branchId,
            phone: phone.length > 0 ? phone : undefined,
            status,
          };
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const responseBody = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(responseBody.error?.message ?? "Gagal menyimpan sales.");
      }
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menyimpan sales.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Tambah Sales Human">
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>
            {isEdit ? "Edit Sales Human" : "+ Tambah Sales Human"}
          </span>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.branchLabel}>Cabang: {branchId}</p>

          <div className={styles.formGroup}>
            <label htmlFor="sales-name" className={styles.formLabel}>
              Nama Lengkap *
            </label>
            <input
              id="sales-name"
              className={styles.formInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ahmad Fauzi"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="sales-email" className={styles.formLabel}>
              Email * (untuk login CRM)
            </label>
            <input
              id="sales-email"
              type="email"
              className={styles.formInput}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ahmad.fauzi@mobix.id"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="sales-password" className={styles.formLabel}>
              {isEdit ? "Ubah Password (opsional)" : "Password * (min 8 karakter)"}
            </label>
            <input
              id="sales-password"
              type="password"
              className={styles.formInput}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="sales-confirm-password" className={styles.formLabel}>
              Konfirmasi Password{isEdit ? "" : " *"}
            </label>
            <input
              id="sales-confirm-password"
              type="password"
              className={styles.formInput}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="sales-phone" className={styles.formLabel}>
              Nomor HP (opsional)
            </label>
            <input
              id="sales-phone"
              className={styles.formInput}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+62812xxxxxxxx"
            />
          </div>

          <div className={styles.formGroup}>
            <span className={styles.formLabel}>Status</span>
            <div className={styles.statusRow}>
              {(["ON", "OFF"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatus(option)}
                  className={`${styles.statusButton} ${status === option ? styles.statusButtonActive : ""}`}
                >
                  {option === "ON" ? "● Aktif" : "○ Tidak Aktif"}
                </button>
              ))}
            </div>
          </div>

          {error !== undefined ? <p className={styles.error}>{error}</p> : null}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className={styles.saveButton}
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "Menyimpan..." : isEdit ? "✓ Simpan" : "✓ Tambah Sales"}
          </button>
        </div>
      </div>
    </div>
  );
}
