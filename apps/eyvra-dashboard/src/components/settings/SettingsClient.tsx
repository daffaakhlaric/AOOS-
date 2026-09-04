"use client";

import { useCallback, useEffect, useState } from "react";

import { TopBar } from "@/components/layout/TopBar";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { CompetitorPageDto } from "@/types/dashboard.types";
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
 *
 * EYVRA MENU RESTRUCTURE Sprint 3 (PROMPT 8) — `/settings` is now `SettingsHubClient`'s real
 * "Koneksi" tab (plus Mode Operasi/Mode Operasi AI/Tenant Info/Account, which this codebase never
 * split into separate real components — see `SettingsHubClient.tsx`'s own doc for that honest
 * scoping decision). `embedded` drops this component's own `<main><TopBar/></main>` wrapper so it
 * renders as plain tab content inside the hub's own `TopBar`/`HubTabs` chrome — every other prop,
 * every real fetch/handler below, is byte-for-byte unchanged.
 */
export function SettingsClient({
  embedded = false,
}: { readonly embedded?: boolean } = {}): React.ReactElement {
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

  const [modeSaving, setModeSaving] = useState(false);
  const [modeError, setModeError] = useState<string | undefined>(undefined);

  const [operatingModeSaving, setOperatingModeSaving] = useState(false);
  const [operatingModeError, setOperatingModeError] = useState<string | undefined>(undefined);

  const [competitors, setCompetitors] = useState<readonly CompetitorPageDto[] | undefined>(
    undefined,
  );
  const [competitorError, setCompetitorError] = useState<string | undefined>(undefined);
  const [competitorName, setCompetitorName] = useState("");
  const [competitorPageId, setCompetitorPageId] = useState("");
  const [competitorVertical, setCompetitorVertical] = useState<"AUTOMOTIVE" | "PROPERTY">(
    "AUTOMOTIVE",
  );
  const [competitorSaving, setCompetitorSaving] = useState(false);
  const [competitorBusyId, setCompetitorBusyId] = useState<string | undefined>(undefined);

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

  const loadCompetitors = useCallback(() => {
    fetch("/api/competitors")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat daftar kompetitor.");
        }
        return (await res.json()) as { competitors: readonly CompetitorPageDto[] };
      })
      .then((body) => setCompetitors(body.competitors))
      .catch((caught: unknown) => {
        setCompetitorError(
          caught instanceof Error ? caught.message : "Gagal memuat daftar kompetitor.",
        );
      });
  }, []);

  useEffect(() => {
    loadSettings();
    loadWaba();
    loadCompetitors();
  }, [loadSettings, loadWaba, loadCompetitors]);

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

  /**
   * "Mode Operasi" card's confirm-dialog action (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase A point
   * 4). A real `window.confirm` — flipping this tenant's mode changes whether Samantha/Kai's real
   * Meta-mutating actions (`ExecuteVerdict`, campaign creation) actually run or are simulated, so
   * it deliberately isn't a single click with no confirmation step.
   */
  async function handleToggleMode(): Promise<void> {
    if (settings === undefined) {
      return;
    }
    const nextMode = settings.tenant.mode === "LIVE" ? "DEV" : "LIVE";
    const confirmed = window.confirm(
      nextMode === "DEV"
        ? "Yakin ingin mengalihkan ke mode DEV? Samantha/Kai TIDAK akan menjalankan aksi nyata ke Meta Ads (pause/scale/fix/buat campaign) selama mode DEV aktif — hanya simulasi."
        : "Yakin ingin mengalihkan ke mode LIVE? Samantha/Kai akan mulai menjalankan aksi NYATA ke Meta Ads (pause/scale/fix/buat campaign).",
    );
    if (!confirmed) {
      return;
    }
    setModeSaving(true);
    setModeError(undefined);
    try {
      const response = await fetch("/api/settings/mode", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: nextMode }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal mengubah mode.");
      }
      loadSettings();
    } catch (caught) {
      setModeError(caught instanceof Error ? caught.message : "Gagal mengubah mode.");
    } finally {
      setModeSaving(false);
    }
  }

  /**
   * "Mode Operasi AI" card's confirm-dialog action (AAOS-OPERATING-MODE-APPROVAL-GATE) — mirrors
   * `handleToggleMode`'s exact real shape. A real `window.confirm`: flipping this tenant's
   * operating mode changes whether Samantha's automated PROPERTY campaign-creation trigger fires
   * immediately or waits for an explicit human Approve, so it deliberately isn't a single click
   * with no confirmation step.
   */
  async function handleToggleOperatingMode(): Promise<void> {
    if (settings === undefined) {
      return;
    }
    const nextOperatingMode =
      settings.tenant.operatingMode === "FULL_CONTROL" ? "APPROVAL" : "FULL_CONTROL";
    const confirmed = window.confirm(
      nextOperatingMode === "APPROVAL"
        ? "Yakin ingin mengalihkan ke mode Approval? Pembuatan campaign otomatis oleh Samantha TIDAK akan langsung dijalankan — setiap trigger akan menunggu persetujuan manusia terlebih dahulu."
        : "Yakin ingin mengalihkan ke mode Full Control? Samantha akan kembali membuat campaign secara otomatis tanpa perlu persetujuan manusia untuk setiap trigger.",
    );
    if (!confirmed) {
      return;
    }
    setOperatingModeSaving(true);
    setOperatingModeError(undefined);
    try {
      const response = await fetch("/api/settings/operating-mode", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operatingMode: nextOperatingMode }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal mengubah mode operasi.");
      }
      loadSettings();
    } catch (caught) {
      setOperatingModeError(
        caught instanceof Error ? caught.message : "Gagal mengubah mode operasi.",
      );
    } finally {
      setOperatingModeSaving(false);
    }
  }

  async function handleAddCompetitor(): Promise<void> {
    if (competitorName.trim().length === 0 || competitorPageId.trim().length === 0) {
      return;
    }
    setCompetitorSaving(true);
    setCompetitorError(undefined);
    try {
      const response = await fetch("/api/competitors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: competitorName.trim(),
          pageId: competitorPageId.trim(),
          vertical: competitorVertical,
          active: true,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal menambah kompetitor.");
      }
      setCompetitorName("");
      setCompetitorPageId("");
      loadCompetitors();
    } catch (caught) {
      setCompetitorError(caught instanceof Error ? caught.message : "Gagal menambah kompetitor.");
    } finally {
      setCompetitorSaving(false);
    }
  }

  async function handleDeleteCompetitor(row: CompetitorPageDto): Promise<void> {
    setCompetitorBusyId(row.id);
    try {
      await fetch(`/api/competitors/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      loadCompetitors();
    } finally {
      setCompetitorBusyId(undefined);
    }
  }

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (settings === undefined || wabaConfigs === undefined) {
    return <LoadingSpinner />;
  }

  const Wrapper = embedded ? "div" : "main";

  return (
    <Wrapper>
      {!embedded ? (
        <TopBar
          title="Settings"
          userEmail={email}
          onSignOut={onSignOut}
          accentColor="var(--v2-menu-settings)"
        />
      ) : null}
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

        <section className={styles.card} data-testid="competitor-pages-card">
          <span className={styles.cardTitle}>Competitor Pages (Samantha Intelligence)</span>
          <p className={styles.hint}>
            Halaman Meta kompetitor yang dipantau Samantha Intelligence untuk sinyal iklan
            kompetitor — dipakai oleh signal &quot;Kompetitor&quot; di halaman Strategi &amp;
            Approve.
          </p>

          {competitorError !== undefined ? <p className={styles.error}>{competitorError}</p> : null}

          {competitors === undefined ? (
            <p className={styles.emptyState}>Memuat daftar kompetitor…</p>
          ) : competitors.length === 0 ? (
            <p className={styles.emptyState}>Belum ada halaman kompetitor yang ditambahkan.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Page ID</th>
                  <th>Vertical</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.pageId}</td>
                    <td>{row.vertical}</td>
                    <td>
                      <span
                        className={`${styles.statusPill} ${
                          row.active ? styles.statusPillActive : styles.statusPillInactive
                        }`}
                      >
                        {row.active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.smallButton}
                          disabled={competitorBusyId === row.id}
                          onClick={() => void handleDeleteCompetitor(row)}
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

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label htmlFor="competitor-name" className={styles.formLabel}>
                Nama Kompetitor
              </label>
              <input
                id="competitor-name"
                className={styles.formInput}
                value={competitorName}
                onChange={(e) => setCompetitorName(e.target.value)}
                placeholder="Suzuki Bintaro"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="competitor-page-id" className={styles.formLabel}>
                Meta Page ID
              </label>
              <input
                id="competitor-page-id"
                className={styles.formInput}
                value={competitorPageId}
                onChange={(e) => setCompetitorPageId(e.target.value)}
                placeholder="1234567890"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="competitor-vertical" className={styles.formLabel}>
                Vertical
              </label>
              <select
                id="competitor-vertical"
                className={styles.formInput}
                value={competitorVertical}
                onChange={(e) =>
                  setCompetitorVertical(e.target.value === "PROPERTY" ? "PROPERTY" : "AUTOMOTIVE")
                }
              >
                <option value="AUTOMOTIVE">AUTOMOTIVE</option>
                <option value="PROPERTY">PROPERTY</option>
              </select>
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleAddCompetitor()}
              disabled={
                competitorSaving ||
                competitorName.trim().length === 0 ||
                competitorPageId.trim().length === 0
              }
            >
              {competitorSaving ? "Menambah..." : "+ Tambah Kompetitor"}
            </button>
          </div>
        </section>

        <section className={styles.card} data-testid="mode-operasi-card">
          <span className={styles.cardTitle}>Mode Operasi</span>
          <p className={styles.hint}>
            DEV: Samantha/Kai hanya mensimulasikan aksi (pause/scale/fix/buat campaign) — tidak ada
            panggilan nyata ke Meta Ads. LIVE: aksi dijalankan nyata ke Meta Ads.
          </p>
          <div className={styles.accountRow}>
            <span
              className={`${styles.statusPill} ${
                settings.tenant.mode === "LIVE"
                  ? styles.statusPillActive
                  : styles.statusPillInactive
              }`}
            >
              {settings.tenant.mode}
            </span>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleToggleMode()}
              disabled={modeSaving}
            >
              {modeSaving
                ? "Menyimpan..."
                : settings.tenant.mode === "LIVE"
                  ? "Alihkan ke DEV"
                  : "Alihkan ke LIVE"}
            </button>
          </div>
          {settings.tenant.modeChangedAt !== undefined ? (
            <p className={styles.hint}>
              Terakhir diubah: {settings.tenant.modeChangedAt}
              {settings.tenant.modeChangedBy !== undefined
                ? ` oleh ${settings.tenant.modeChangedBy}`
                : ""}
            </p>
          ) : null}
          {modeError !== undefined ? <p className={styles.error}>{modeError}</p> : null}
        </section>

        <section className={styles.card} data-testid="operating-mode-card">
          <span className={styles.cardTitle}>Mode Operasi AI</span>
          <p className={styles.hint}>
            Full Control: Samantha membuat campaign PROPERTY otomatis tanpa perlu persetujuan
            manusia. Approval: setiap trigger pembuatan campaign otomatis menunggu persetujuan
            manusia terlebih dahulu sebelum campaign benar-benar dibuat.
          </p>
          <div className={styles.accountRow}>
            <span
              className={`${styles.statusPill} ${
                settings.tenant.operatingMode === "FULL_CONTROL"
                  ? styles.statusPillActive
                  : styles.statusPillInactive
              }`}
            >
              {settings.tenant.operatingMode}
            </span>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleToggleOperatingMode()}
              disabled={operatingModeSaving}
            >
              {operatingModeSaving
                ? "Menyimpan..."
                : settings.tenant.operatingMode === "FULL_CONTROL"
                  ? "Alihkan ke Approval"
                  : "Alihkan ke Full Control"}
            </button>
          </div>
          {settings.tenant.operatingModeChangedAt !== undefined ? (
            <p className={styles.hint}>
              Terakhir diubah: {settings.tenant.operatingModeChangedAt}
              {settings.tenant.operatingModeChangedBy !== undefined
                ? ` oleh ${settings.tenant.operatingModeChangedBy}`
                : ""}
            </p>
          ) : null}
          {operatingModeError !== undefined ? (
            <p className={styles.error}>{operatingModeError}</p>
          ) : null}
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
    </Wrapper>
  );
}
