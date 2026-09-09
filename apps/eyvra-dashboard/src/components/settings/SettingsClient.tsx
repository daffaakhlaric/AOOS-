"use client";

import { useCallback, useEffect, useState } from "react";

import { TopBar } from "@/components/layout/TopBar";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { CompetitorPageDto } from "@/types/dashboard.types";
import type {
  OAuthStatusDto,
  SettingsDto,
  TestConnectionResultDto,
  WabaConfigDto,
} from "@/types/tenant.types";

import styles from "./SettingsClient.module.css";
import { WabaConfigModal } from "./WabaConfigModal";

const FACEBOOK_SDK_SCRIPT_ID = "facebook-jssdk";
const META_GRAPH_API_VERSION = "v21.0";

// EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 3 — minimal, honest typing for the real Facebook JS SDK
// global (`window.FB`/`window.fbAsyncInit`), Meta's own documented shape
// (developers.facebook.com/docs/javascript/reference/FB.init). No `@types/facebook-js-sdk`
// package is installed (would be a real new dependency for one narrow use), so this is typed
// loosely, same "minimal, file-local `any`-adjacent test double for an external SDK shape"
// precedent already used elsewhere in this codebase (`webhook-secrets.service.ts`'s own doc, and
// every `as any` minimal-double comment in `apps/aaos-api`'s specs).
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- real external Facebook JS SDK global, no first-party types package installed for this one narrow use
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

/**
 * Loads the real Facebook JS SDK script (`connect.facebook.net/en_US/sdk.js`) and calls
 * `FB.init`, exactly matching Meta's own documented embed snippet — idempotent (a second call
 * while already loading/loaded resolves once the existing load finishes, never double-injects the
 * script tag). Used ONLY by the WhatsApp Embedded Signup button below; the "Connect dengan
 * Facebook" (Meta Ads OAuth) button never touches this — that flow is a plain server-side
 * redirect (`GET /oauth/meta/connect`), not a client-side SDK call.
 */
let facebookSdkLoadPromise: Promise<void> | undefined;
function ensureFacebookSdkLoaded(appId: string): Promise<void> {
  if (window.FB !== undefined) {
    return Promise.resolve();
  }
  if (facebookSdkLoadPromise !== undefined) {
    return facebookSdkLoadPromise;
  }
  facebookSdkLoadPromise = new Promise<void>((resolve, reject) => {
    window.fbAsyncInit = (): void => {
      window.FB?.init({
        appId,
        autoLogAppUser: false,
        xfbml: false,
        version: META_GRAPH_API_VERSION,
      });
      resolve();
    };
    if (document.getElementById(FACEBOOK_SDK_SCRIPT_ID) !== null) {
      return;
    }
    const script = document.createElement("script");
    script.id = FACEBOOK_SDK_SCRIPT_ID;
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = (): void => {
      reject(new Error("Gagal memuat Facebook JS SDK."));
    };
    document.body.appendChild(script);
  });
  return facebookSdkLoadPromise;
}

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

  const [oauthStatus, setOauthStatus] = useState<OAuthStatusDto | undefined>(undefined);
  const [oauthError, setOauthError] = useState<string | undefined>(undefined);
  const [metaConnecting, setMetaConnecting] = useState(false);
  const [metaDisconnecting, setMetaDisconnecting] = useState(false);

  const [waEmbeddedBranchId, setWaEmbeddedBranchId] = useState("");
  const [waEmbeddedBusy, setWaEmbeddedBusy] = useState(false);
  const [waEmbeddedResult, setWaEmbeddedResult] = useState<
    { readonly success: boolean; readonly message: string } | undefined
  >(undefined);

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

  const loadOAuthStatus = useCallback(() => {
    fetch("/api/oauth/status")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat status koneksi OAuth.");
        }
        return (await res.json()) as OAuthStatusDto;
      })
      .then((data) => setOauthStatus(data))
      .catch((caught: unknown) => {
        setOauthError(
          caught instanceof Error ? caught.message : "Gagal memuat status koneksi OAuth.",
        );
      });
  }, []);

  useEffect(() => {
    loadSettings();
    loadWaba();
    loadCompetitors();
    loadOAuthStatus();
  }, [loadSettings, loadWaba, loadCompetitors, loadOAuthStatus]);

  /** Meta Ads Configuration card's "Connect dengan Facebook" — real `GET /oauth/meta/connect`, then a plain browser navigation to Meta's own consent-dialog URL. */
  async function handleConnectMeta(): Promise<void> {
    setMetaConnecting(true);
    setOauthError(undefined);
    try {
      const response = await fetch("/api/oauth/meta/connect");
      const body = (await response.json().catch(() => ({}))) as
        { authorizeUrl?: string } | { error?: { message?: string } };
      if (!response.ok || !("authorizeUrl" in body) || body.authorizeUrl === undefined) {
        const message =
          "error" in body
            ? (body.error?.message ?? "Gagal memulai koneksi Meta.")
            : "Gagal memulai koneksi Meta.";
        throw new Error(message);
      }
      window.location.href = body.authorizeUrl;
    } catch (caught) {
      setOauthError(caught instanceof Error ? caught.message : "Gagal memulai koneksi Meta.");
      setMetaConnecting(false);
    }
  }

  /** Meta Ads Configuration card's "Disconnect" — reverts to `meta_connection_source: 'manual'`; the existing manual token below (if any) keeps working immediately after. */
  async function handleDisconnectMeta(): Promise<void> {
    const confirmed = window.confirm(
      "Putuskan koneksi Meta Ads OAuth? Tenant ini akan kembali memakai token manual (jika ada) di bawah.",
    );
    if (!confirmed) {
      return;
    }
    setMetaDisconnecting(true);
    setOauthError(undefined);
    try {
      const response = await fetch("/api/oauth/meta/disconnect", { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal memutuskan koneksi Meta.");
      }
      loadOAuthStatus();
      loadSettings();
    } catch (caught) {
      setOauthError(caught instanceof Error ? caught.message : "Gagal memutuskan koneksi Meta.");
    } finally {
      setMetaDisconnecting(false);
    }
  }

  /**
   * WhatsApp Business card's "Connect dengan WhatsApp (Embedded Signup)" — real `FB.login` call
   * per Meta's documented WhatsApp Embedded Signup shape, forwarding the resulting token to the
   * real `POST /oauth/wa/embedded-signup` backend endpoint.
   *
   * HONEST SANDBOX LIMITATION (documented per this sprint's own discipline, also in the commit
   * message): live end-to-end verification of this exact button — a real Meta App's
   * `NEXT_PUBLIC_META_APP_ID` + a real WhatsApp Embedded Signup configuration ID
   * (`NEXT_PUBLIC_META_WA_EMBEDDED_SIGNUP_CONFIG_ID`, created in the Meta App dashboard) — is not
   * provisionable in this sandbox. The button, the SDK wiring, and the backend endpoint it calls
   * are all real and wired per Meta's own documented API shape; only a live `FB.login` popup
   * round-trip against a real registered Meta App could not be exercised here.
   */
  async function handleStartEmbeddedSignup(): Promise<void> {
    if (waEmbeddedBranchId.trim().length === 0) {
      setWaEmbeddedResult({ success: false, message: "Cabang wajib diisi sebelum menghubungkan." });
      return;
    }
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    const configId = process.env.NEXT_PUBLIC_META_WA_EMBEDDED_SIGNUP_CONFIG_ID;
    if (
      appId === undefined ||
      appId.length === 0 ||
      configId === undefined ||
      configId.length === 0
    ) {
      setWaEmbeddedResult({
        success: false,
        message:
          "Embedded Signup belum dikonfigurasi — NEXT_PUBLIC_META_APP_ID/NEXT_PUBLIC_META_WA_EMBEDDED_SIGNUP_CONFIG_ID belum di-set. Gunakan form manual di bawah untuk sekarang.",
      });
      return;
    }

    setWaEmbeddedBusy(true);
    setWaEmbeddedResult(undefined);
    try {
      await ensureFacebookSdkLoaded(appId);
      const token = await new Promise<string>((resolve, reject) => {
        window.FB?.login(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- real Facebook JS SDK callback shape, no first-party types installed
          (response: any) => {
            const accessToken: string | undefined = response?.authResponse?.accessToken;
            if (accessToken === undefined || accessToken.length === 0) {
              reject(new Error("Login WhatsApp Embedded Signup dibatalkan atau gagal."));
              return;
            }
            resolve(accessToken);
          },
          {
            config_id: configId,
            response_type: "code",
            override_default_response_type: true,
            extras: { feature: "whatsapp_embedded_signup", sessionInfoVersion: "3" },
          },
        );
      });

      const response = await fetch("/api/oauth/wa/embedded-signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, branchId: waEmbeddedBranchId.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(body.error?.message ?? "Gagal menghubungkan WhatsApp via Embedded Signup.");
      }
      setWaEmbeddedResult({
        success: body.success ?? false,
        message: body.message ?? "Selesai.",
      });
      loadWaba();
      loadOAuthStatus();
    } catch (caught) {
      setWaEmbeddedResult({
        success: false,
        message:
          caught instanceof Error
            ? caught.message
            : "Gagal menghubungkan WhatsApp via Embedded Signup.",
      });
    } finally {
      setWaEmbeddedBusy(false);
    }
  }

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
  // Defensive: `oauthStatus` may come back with an unexpected/partial shape (e.g. a test double, or
  // a real upstream degrade) — every read below goes through this, never a bare `oauthStatus.meta`,
  // so a malformed response can never crash the render.
  const metaOauth = oauthStatus?.meta;
  const metaOauthConnected = metaOauth?.source === "oauth" && metaOauth.connected;

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

          {/* EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 3 — real Facebook Login (Meta Ads OAuth) block, an
              ALTERNATIVE to the manual Ad Account ID/Access Token form below, not a replacement for it
              (Prompt 9's own "manual connection for existing tenants" requirement). */}
          <div className={styles.accountRow}>
            {metaOauth !== undefined ? (
              <span
                className={`${styles.statusPill} ${
                  metaOauthConnected ? styles.statusPillActive : styles.statusPillInactive
                }`}
              >
                {metaOauth.source === "oauth"
                  ? metaOauthConnected
                    ? "OAuth — Terhubung"
                    : "OAuth — Terputus"
                  : "Manual"}
              </span>
            ) : null}
            {metaOauthConnected ? (
              <button
                type="button"
                className={styles.smallButton}
                onClick={() => void handleDisconnectMeta()}
                disabled={metaDisconnecting}
              >
                {metaDisconnecting ? "Memutuskan..." : "Disconnect"}
              </button>
            ) : (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void handleConnectMeta()}
                disabled={metaConnecting}
              >
                {metaConnecting ? "Mengalihkan ke Facebook..." : "Connect dengan Facebook"}
              </button>
            )}
          </div>
          {metaOauthConnected ? (
            <div className={styles.infoGrid}>
              <div>
                <div className={styles.infoLabel}>Akun Facebook</div>
                <div className={styles.infoValue}>{metaOauth?.fbUserName ?? "-"}</div>
              </div>
              <div>
                <div className={styles.infoLabel}>Ad Account</div>
                <div className={styles.infoValue}>{metaOauth?.adAccountId ?? "-"}</div>
              </div>
              <div>
                <div className={styles.infoLabel}>Token Berlaku Sampai</div>
                <div className={styles.infoValue}>{metaOauth?.tokenExpiresAt ?? "-"}</div>
              </div>
            </div>
          ) : null}
          {oauthError !== undefined ? <p className={styles.error}>{oauthError}</p> : null}

          <p className={styles.hint}>
            Atau, hubungkan secara manual dengan Ad Account ID + Access Token di bawah ini:
          </p>
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

          {/* EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 3 — real WhatsApp Embedded Signup block, an
              ALTERNATIVE to "+ Tambah WABA"'s manual form below, not a replacement for it. See
              `handleStartEmbeddedSignup`'s own doc for the honest sandbox limitation on live
              `FB.login` verification. */}
          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label htmlFor="wa-embedded-branch" className={styles.formLabel}>
                Cabang (untuk Embedded Signup)
              </label>
              <input
                id="wa-embedded-branch"
                className={styles.formInput}
                value={waEmbeddedBranchId}
                onChange={(e) => setWaEmbeddedBranchId(e.target.value)}
                placeholder="BINTARO"
              />
            </div>
            <button
              type="button"
              className={styles.smallButton}
              onClick={() => void handleStartEmbeddedSignup()}
              disabled={waEmbeddedBusy}
            >
              {waEmbeddedBusy ? "Menghubungkan..." : "Connect dengan WhatsApp (Embedded Signup)"}
            </button>
          </div>
          {waEmbeddedResult !== undefined ? (
            <p
              className={`${styles.testResult} ${
                waEmbeddedResult.success ? styles.testResultSuccess : styles.testResultFailure
              }`}
            >
              {waEmbeddedResult.success ? "✓ " : "✕ "}
              {waEmbeddedResult.message}
            </p>
          ) : null}
          <p className={styles.hint}>Atau tambahkan/kelola WABA secara manual di bawah ini:</p>

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
