"use client";

import { useState } from "react";

import type {
  CreateWabaConfigInput,
  UpdateWabaConfigInput,
  WabaConfigDto,
} from "@/types/tenant.types";

import styles from "./WabaConfigModal.module.css";

export interface WabaConfigModalProps {
  /** `undefined` = Add mode (`POST /api/settings/waba`); a real row = Edit mode (`PUT /api/settings/waba/:id`, access token left blank means "tidak berubah"). */
  readonly editing?: WabaConfigDto;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

/** "+ Tambah WABA" / row "[Edit]" modal (Part 2's WhatsApp Business card). */
export function WabaConfigModal({
  editing,
  onClose,
  onSaved,
}: WabaConfigModalProps): React.ReactElement {
  const isEdit = editing !== undefined;
  const [branchId, setBranchId] = useState(editing?.branchId ?? "");
  const [phoneNumber, setPhoneNumber] = useState(editing?.phoneNumber ?? "");
  const [wabaId, setWabaId] = useState(editing?.wabaId ?? "");
  const [phoneNumberId, setPhoneNumberId] = useState(editing?.phoneNumberId ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  function validate(): string | undefined {
    if (branchId.trim().length === 0) {
      return "Cabang wajib diisi.";
    }
    if (phoneNumber.trim().length === 0) {
      return "Nomor WA wajib diisi.";
    }
    if (wabaId.trim().length === 0) {
      return "WABA ID wajib diisi.";
    }
    if (phoneNumberId.trim().length === 0) {
      return "Phone Number ID wajib diisi.";
    }
    if (!isEdit && accessToken.trim().length === 0) {
      return "Access Token wajib diisi.";
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
        ? `/api/settings/waba/${encodeURIComponent(editing.id)}`
        : "/api/settings/waba";
      const body: CreateWabaConfigInput | UpdateWabaConfigInput = isEdit
        ? {
            branchId,
            phoneNumber,
            wabaId,
            phoneNumberId,
            ...(accessToken.length > 0 ? { accessToken } : {}),
          }
        : { branchId, phoneNumber, wabaId, phoneNumberId, accessToken };
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const responseBody = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(responseBody.error?.message ?? "Gagal menyimpan WABA.");
      }
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menyimpan WABA.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="WABA">
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>{isEdit ? "Edit WABA" : "+ Tambah WABA"}</span>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.formGroup}>
            <label htmlFor="waba-branch" className={styles.formLabel}>
              Cabang *
            </label>
            <input
              id="waba-branch"
              className={styles.formInput}
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              placeholder="BINTARO"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="waba-phone" className={styles.formLabel}>
              Nomor WA *
            </label>
            <input
              id="waba-phone"
              className={styles.formInput}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+62812xxxxxxxx"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="waba-id" className={styles.formLabel}>
              WABA ID *
            </label>
            <input
              id="waba-id"
              className={styles.formInput}
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="waba-phone-id" className={styles.formLabel}>
              Phone Number ID *
            </label>
            <input
              id="waba-phone-id"
              className={styles.formInput}
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="waba-token" className={styles.formLabel}>
              {isEdit ? "Access Token (kosongkan jika tidak berubah)" : "Access Token *"}
            </label>
            <input
              id="waba-token"
              type="password"
              className={styles.formInput}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="••••••••••••"
            />
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
            {saving ? "Menyimpan..." : "💾 Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
