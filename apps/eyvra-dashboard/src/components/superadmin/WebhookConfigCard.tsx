"use client";

import { useCallback, useEffect, useState } from "react";

import type { WebhookConfigDto } from "@/types/tenant.types";

import styles from "./WebhookConfigCard.module.css";

function placeholderFor(isSet: boolean, masked: string | undefined): string {
  if (!isSet) {
    return "Belum diatur — memakai default dari server";
  }
  return masked !== undefined ? `●●●● (tersimpan: ${masked})` : "●●●● (tersimpan)";
}

/**
 * `/superadmin` card — the GLOBAL (not per-tenant) Meta/WhatsApp webhook verify-token + app-secret
 * override (AAOS-SETTINGS-WEBHOOK-CONFIG, Part C). One shared "Simpan" for all 4 real fields
 * (small real field count — no need for 4 separate save calls). Every input is password-style and
 * NEVER pre-filled with a real or fabricated secret string — only a "tersimpan" placeholder when
 * an override already exists, per `GET /api/superadmin/webhook-config`'s own masked-only contract.
 * Leaving a field blank on Simpan means "no change" (real, un-set values require an explicit
 * empty-string clear — not implemented as a UI affordance here to avoid an easy accidental
 * clear-to-`.env` click; a superadmin who wants to revert a field to the server default can still
 * type nothing to leave it, or contact engineering for a direct clear — matching this card's
 * "small, rarely-touched" real field count).
 */
export function WebhookConfigCard(): React.ReactElement {
  const [config, setConfig] = useState<WebhookConfigDto | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);

  const [whatsappVerifyToken, setWhatsappVerifyToken] = useState("");
  const [whatsappAppSecret, setWhatsappAppSecret] = useState("");
  const [metaVerifyToken, setMetaVerifyToken] = useState("");
  const [metaAppSecret, setMetaAppSecret] = useState("");

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<
    { readonly success: boolean; readonly message: string } | undefined
  >(undefined);

  const load = useCallback(() => {
    setLoadError(undefined);
    fetch("/api/superadmin/webhook-config")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat konfigurasi webhook.");
        }
        return (await res.json()) as WebhookConfigDto;
      })
      .then(setConfig)
      .catch((caught: unknown) => {
        setLoadError(
          caught instanceof Error ? caught.message : "Gagal memuat konfigurasi webhook.",
        );
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(): Promise<void> {
    setSaving(true);
    setResult(undefined);
    try {
      const body: Record<string, Record<string, string>> = {};
      if (whatsappVerifyToken.length > 0 || whatsappAppSecret.length > 0) {
        body.whatsapp = {
          ...(whatsappVerifyToken.length > 0 ? { verifyToken: whatsappVerifyToken } : {}),
          ...(whatsappAppSecret.length > 0 ? { appSecret: whatsappAppSecret } : {}),
        };
      }
      if (metaVerifyToken.length > 0 || metaAppSecret.length > 0) {
        body.meta = {
          ...(metaVerifyToken.length > 0 ? { verifyToken: metaVerifyToken } : {}),
          ...(metaAppSecret.length > 0 ? { appSecret: metaAppSecret } : {}),
        };
      }
      const response = await fetch("/api/superadmin/webhook-config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const responseBody = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(responseBody.error?.message ?? "Gagal menyimpan konfigurasi webhook.");
      }
      const data = (await response.json()) as WebhookConfigDto;
      setConfig(data);
      setWhatsappVerifyToken("");
      setWhatsappAppSecret("");
      setMetaVerifyToken("");
      setMetaAppSecret("");
      setResult({ success: true, message: "Konfigurasi webhook tersimpan." });
    } catch (caught) {
      setResult({
        success: false,
        message: caught instanceof Error ? caught.message : "Gagal menyimpan konfigurasi webhook.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>🔐 Webhook Config (Global)</span>
        <span className={styles.caption}>
          Berlaku global untuk semua tenant. Kosongkan untuk memakai default dari server.
        </span>
      </div>

      {loadError !== undefined ? <p className={styles.resultFailure}>{loadError}</p> : null}

      <div className={styles.grid}>
        <div className={styles.group}>
          <span className={styles.groupLabel}>WhatsApp</span>
          <div className={styles.formGroup}>
            <label htmlFor="wh-wa-verify" className={styles.formLabel}>
              Verify Token
            </label>
            <input
              id="wh-wa-verify"
              type="password"
              className={styles.formInput}
              value={whatsappVerifyToken}
              onChange={(e) => setWhatsappVerifyToken(e.target.value)}
              placeholder={placeholderFor(
                config?.whatsapp?.verifyTokenSet ?? false,
                config?.whatsapp?.verifyTokenMasked,
              )}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="wh-wa-secret" className={styles.formLabel}>
              App Secret
            </label>
            <input
              id="wh-wa-secret"
              type="password"
              className={styles.formInput}
              value={whatsappAppSecret}
              onChange={(e) => setWhatsappAppSecret(e.target.value)}
              placeholder={placeholderFor(
                config?.whatsapp?.appSecretSet ?? false,
                config?.whatsapp?.appSecretMasked,
              )}
            />
          </div>
        </div>

        <div className={styles.group}>
          <span className={styles.groupLabel}>Meta</span>
          <div className={styles.formGroup}>
            <label htmlFor="wh-meta-verify" className={styles.formLabel}>
              Verify Token
            </label>
            <input
              id="wh-meta-verify"
              type="password"
              className={styles.formInput}
              value={metaVerifyToken}
              onChange={(e) => setMetaVerifyToken(e.target.value)}
              placeholder={placeholderFor(
                config?.meta?.verifyTokenSet ?? false,
                config?.meta?.verifyTokenMasked,
              )}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="wh-meta-secret" className={styles.formLabel}>
              App Secret
            </label>
            <input
              id="wh-meta-secret"
              type="password"
              className={styles.formInput}
              value={metaAppSecret}
              onChange={(e) => setMetaAppSecret(e.target.value)}
              placeholder={placeholderFor(
                config?.meta?.appSecretSet ?? false,
                config?.meta?.appSecretMasked,
              )}
            />
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.saveButton}
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? "Menyimpan..." : "💾 Simpan"}
        </button>
        {result !== undefined ? (
          <span
            className={`${styles.result} ${result.success ? styles.resultSuccess : styles.resultFailure}`}
          >
            {result.success ? "✓ " : "✕ "}
            {result.message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
