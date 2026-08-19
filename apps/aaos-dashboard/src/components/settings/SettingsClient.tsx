"use client";

import { useCallback, useEffect, useState } from "react";

import { TopBar } from "@/components/layout/TopBar";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { SettingsDto, TestConnectionResultDto, WabaConfigDto } from "@/types/tenant.types";

import styles from "./SettingsClient.module.css";
import { WabaConfigModal } from "./WabaConfigModal";

function useSignOut(): { readonly email: string | undefined; readonly onSignOut: () => void } {
  const [email, setEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .getUser()
      .then(({ data }) => setEmail(data.user?.email))
      .catch(() => undefined);
  }, []);

  function onSignOut(): void {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.signOut().then(() => {
      window.location.href = "/login";
    });
  }

  return { email, onSignOut };
}

/**
 * `/settings` — the tenant Settings page (Part 2, Phase 1 of AAOS-MULTI-TENANT-SUPERADMIN-
 * PROPERTY): Meta Ads Configuration card, WhatsApp Business (WABA) card, Tenant Info card,
 * Account card. Account's [🚪 Logout] wires `TopBar`'s pre-existing (previously never actually
 * used anywhere in this app) `onSignOut` prop to a real `supabase.auth.signOut()` call — this is
 * the first page in this codebase to wire that affordance up, not a rebuild of a second mechanism.
 */
export function SettingsClient(): React.ReactElement {
  const { email, onSignOut } = useSignOut();
  const [settings, setSettings] = useState<SettingsDto | undefined>(undefined);
  const [wabaConfigs, setWabaConfigs] = useState<readonly WabaConfigDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaTesting, setMetaTesting] = useState(false);
  const [metaTestResult, setMetaTestResult] = useState<TestConnectionResultDto | undefined>(
    undefined,
  );
  const [metaError, setMetaError] = useState<string | undefined>(undefined);

  const [showWabaModal, setShowWabaModal] = useState(false);
  const [editingWaba, setEditingWaba] = useState<WabaConfigDto | undefined>(undefined);
  const [wabaBusyId, setWabaBusyId] = useState<string | undefined>(undefined);
  const [wabaTestResults, setWabaTestResults] = useState<Record<string, TestConnectionResultDto>>(
    {},
  );

  const loadSettings = useCallback(() => {
    fetch("/api/settings")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat pengaturan.");
        }
        return (await res.json()) as SettingsDto;
      })
      .then((data) => {
        setSettings(data);
        setMetaAdAccountId(data.meta.adAccountId ?? "");
        setMetaAccessToken(data.meta.accessToken ?? "");
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat pengaturan.");
      });
  }, []);

  const loadWaba = useCallback(() => {
    fetch("/api/settings/waba")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat WABA.");
        }
        return (await res.json()) as { wabaConfigs: readonly WabaConfigDto[] };
      })
      .then((body) => setWabaConfigs(body.wabaConfigs))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat WABA.");
      });
  }, []);

  useEffect(() => {
    loadSettings();
    loadWaba();
  }, [loadSettings, loadWaba]);

  async function handleSaveMeta(): Promise<void> {
    setMetaSaving(true);
    setMetaError(undefined);
    setMetaTestResult(undefined);
    try {
      const response = await fetch("/api/settings/meta", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(metaAdAccountId.length > 0 ? { adAccountId: metaAdAccountId } : {}),
          ...(metaAccessToken.length > 0 ? { accessToken: metaAccessToken } : {}),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal menyimpan konfigurasi Meta.");
      }
      loadSettings();
    } catch (caught) {
      setMetaError(caught instanceof Error ? caught.message : "Gagal menyimpan konfigurasi Meta.");
    } finally {
      setMetaSaving(false);
    }
  }

  async function handleTestMeta(): Promise<void> {
    setMetaTesting(true);
    setMetaTestResult(undefined);
    setMetaError(undefined);
    try {
      const response = await fetch("/api/settings/meta/test", { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as TestConnectionResultDto;
      setMetaTestResult(body);
    } catch (caught) {
      setMetaError(caught instanceof Error ? caught.message : "Gagal menguji koneksi Meta.");
    } finally {
      setMetaTesting(false);
    }
  }

  async function handleTestWaba(row: WabaConfigDto): Promise<void> {
    setWabaBusyId(row.id);
    try {
      const response = await fetch(`/api/settings/waba/${encodeURIComponent(row.id)}/test`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as TestConnectionResultDto;
      setWabaTestResults((prev) => ({ ...prev, [row.id]: body }));
      loadWaba();
    } finally {
      setWabaBusyId(undefined);
    }
  }

  async function handleDeleteWaba(row: WabaConfigDto): Promise<void> {
    setWabaBusyId(row.id);
    try {
      await fetch(`/api/settings/waba/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      loadWaba();
    } finally {
      setWabaBusyId(undefined);
    }
  }

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (settings === undefined || wabaConfigs === undefined) {
    return <LoadingSpinner />;
  }

  return (
    <main>
      <TopBar title="Settings" userEmail={email} onSignOut={onSignOut} />
      <div className={styles.page}>
        <section className={styles.card}>
          <span className={styles.cardTitle}>Meta Ads Configuration</span>
          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label htmlFor="meta-ad-account" className={styles.formLabel}>
                Ad Account ID
              </label>
              <input
                id="meta-ad-account"
                className={styles.formInput}
                value={metaAdAccountId}
                onChange={(e) => setMetaAdAccountId(e.target.value)}
                placeholder="act_752xxxxxx"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="meta-token" className={styles.formLabel}>
                Access Token
              </label>
              <div className={styles.tokenRow}>
                <input
                  id="meta-token"
                  type={showToken ? "text" : "password"}
                  className={styles.formInput}
                  value={metaAccessToken}
                  onChange={(e) => setMetaAccessToken(e.target.value)}
                  placeholder="EAAxxxxxxxxxxxxxxx"
                />
                <button
                  type="button"
                  className={styles.smallButton}
                  onClick={() => setShowToken((prev) => !prev)}
                >
                  {showToken ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>
          <p className={styles.hint}>
            {settings.meta.usingEnvDefault
              ? "Belum ada token khusus tenant — saat ini memakai token default deployment."
              : "Tenant ini memakai token Meta miliknya sendiri."}
          </p>
          <div className={styles.buttonRow}>
            <button
              type="button"
              className={styles.smallButton}
              onClick={() => void handleTestMeta()}
              disabled={metaTesting}
            >
              {metaTesting ? "Menguji..." : "Test Koneksi"}
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleSaveMeta()}
              disabled={metaSaving}
            >
              {metaSaving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
          {metaTestResult !== undefined ? (
            <p
              className={`${styles.testResult} ${
                metaTestResult.success ? styles.testResultSuccess : styles.testResultFailure
              }`}
            >
              {metaTestResult.success ? "✓ " : "✕ "}
              {metaTestResult.message}
            </p>
          ) : null}
          {metaError !== undefined ? <p className={styles.error}>{metaError}</p> : null}
        </section>

        <section className={styles.card}>
          <div className={styles.accountRow}>
            <span className={styles.cardTitle}>WhatsApp Business (WABA)</span>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                setEditingWaba(undefined);
                setShowWabaModal(true);
              }}
            >
              + Tambah WABA
            </button>
          </div>
          {wabaConfigs.length === 0 ? (
            <p className={styles.emptyState}>Belum ada WABA yang dikonfigurasi.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Cabang</th>
                  <th>Nomor WA</th>
                  <th>WABA ID</th>
                  <th>Token</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {wabaConfigs.map((row) => (
                  <tr key={row.id}>
                    <td>{row.branchId}</td>
                    <td>{row.phoneNumber}</td>
                    <td>{row.wabaId}</td>
                    <td>{row.maskedAccessToken}</td>
                    <td>
                      <span
                        className={`${styles.statusPill} ${
                          row.status === "ACTIVE"
                            ? styles.statusPillActive
                            : styles.statusPillInactive
                        }`}
                      >
                        {row.status}
                      </span>
                      {wabaTestResults[row.id] !== undefined ? (
                        <div
                          className={`${styles.testResult} ${
                            wabaTestResults[row.id]?.success
                              ? styles.testResultSuccess
                              : styles.testResultFailure
                          }`}
                        >
                          {wabaTestResults[row.id]?.message}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.smallButton}
                          disabled={wabaBusyId === row.id}
                          onClick={() => void handleTestWaba(row)}
                        >
                          Test
                        </button>
                        <button
                          type="button"
                          className={styles.smallButton}
                          onClick={() => {
                            setEditingWaba(row);
                            setShowWabaModal(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.smallButton}
                          disabled={wabaBusyId === row.id}
                          onClick={() => void handleDeleteWaba(row)}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.card}>
          <span className={styles.cardTitle}>Tenant Info</span>
          <div className={styles.infoGrid}>
            <div>
              <div className={styles.infoLabel}>Nama</div>
              <div className={styles.infoValue}>{settings.tenant.name}</div>
            </div>
            <div>
              <div className={styles.infoLabel}>Vertical</div>
              <div className={styles.infoValue}>{settings.tenant.vertical}</div>
            </div>
            <div>
              <div className={styles.infoLabel}>Status</div>
              <div className={styles.infoValue}>{settings.tenant.status}</div>
            </div>
            <div>
              <div className={styles.infoLabel}>Trial Berakhir</div>
              <div className={styles.infoValue}>{settings.tenant.trialEndsAt ?? "-"}</div>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <span className={styles.cardTitle}>Account</span>
          <div className={styles.accountRow}>
            <span>{email ?? "-"}</span>
            <button type="button" className={styles.smallButton} onClick={onSignOut}>
              🚪 Logout
            </button>
          </div>
        </section>
      </div>

      {showWabaModal ? (
        <WabaConfigModal
          editing={editingWaba}
          onClose={() => setShowWabaModal(false)}
          onSaved={() => {
            setShowWabaModal(false);
            loadWaba();
          }}
        />
      ) : null}
    </main>
  );
}
