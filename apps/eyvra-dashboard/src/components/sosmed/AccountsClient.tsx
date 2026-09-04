"use client";

import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDateId, formatNumber } from "@/lib/formatters";
import { PLATFORM_COLOR, PLATFORM_LABEL } from "@/lib/sosmed-format";
import type { CreateConnectLinkResponseDto, SosmedAccountDto } from "@/types/sosmed.types";

import styles from "./Sosmed.shared.module.css";

/**
 * `/sosmed/accounts` (AAOS-SOSMED-AUTOMATION Phase 5, Page 6 "Akun Terhubung") — OFFICIAL +
 * SALES_PERSONAL account lists from the real, masked `GET /api/v1/sosmed/accounts`.
 * "+ Hubungkan Akun Official" calls the real `GET /api/v1/sosmed/oauth/official/start` and
 * navigates the manager's own browser to the returned `authorizeUrl` (a real top-level redirect —
 * Meta's consent screen requires one, same reasoning `SosmedOAuthController`'s own class doc
 * gives for why the callback can't be `x-api-key`-guarded). "+ Hubungkan Akun Sales" calls the real
 * `POST /api/v1/sosmed/oauth/sales/connect-links` and shows the generated `connectUrl` for the
 * manager to copy/send over WhatsApp — no in-app "Kirim via WA" integration exists anywhere in
 * this codebase, so that spec button is a plain `wa.me` share link (real, uses the real generated
 * URL) rather than a fabricated in-app send. "Refresh Token" (spec's Akun Terhubung mockup) is
 * omitted — `SosmedOAuthService` has no real token-refresh use case yet (only initial connect +
 * disconnect), so a button for it would call nothing real.
 */
export function AccountsClient(): React.ReactElement {
  const [accounts, setAccounts] = useState<readonly SosmedAccountDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [connectingOfficial, setConnectingOfficial] = useState(false);
  const [salesHumanIdInput, setSalesHumanIdInput] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<CreateConnectLinkResponseDto | undefined>(
    undefined,
  );
  const [linkError, setLinkError] = useState<string | undefined>(undefined);

  const load = useCallback(() => {
    fetch("/api/sosmed/accounts")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat akun terhubung.");
        }
        return (await res.json()) as { accounts: readonly SosmedAccountDto[] };
      })
      .then((body) => setAccounts(body.accounts))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat Akun Terhubung.");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleConnectOfficial(): Promise<void> {
    setConnectingOfficial(true);
    try {
      const response = await fetch("/api/sosmed/oauth/official/start");
      if (response.ok) {
        const body = (await response.json()) as { authorizeUrl: string };
        window.location.href = body.authorizeUrl;
        return;
      }
    } finally {
      setConnectingOfficial(false);
    }
  }

  async function handleGenerateSalesLink(): Promise<void> {
    if (salesHumanIdInput.trim().length === 0) {
      return;
    }
    setGeneratingLink(true);
    setLinkError(undefined);
    setGeneratedLink(undefined);
    try {
      const response = await fetch("/api/sosmed/oauth/sales/connect-links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ salesHumanId: salesHumanIdInput.trim() }),
      });
      if (response.ok) {
        setGeneratedLink((await response.json()) as CreateConnectLinkResponseDto);
      } else {
        const body = (await response.json().catch(() => undefined)) as
          { error?: { message?: string } } | undefined;
        setLinkError(body?.error?.message ?? "Gagal membuat link koneksi.");
      }
    } finally {
      setGeneratingLink(false);
    }
  }

  async function handleDisconnect(id: string): Promise<void> {
    const response = await fetch(`/api/sosmed/accounts/${id}`, { method: "DELETE" });
    if (response.ok) {
      load();
    }
  }

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }

  if (accounts === undefined) {
    return <LoadingSpinner />;
  }

  const official = accounts.filter((a) => a.accountType === "OFFICIAL");
  const sales = accounts.filter((a) => a.accountType === "SALES_PERSONAL");

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Akun Terhubung</h2>
          <p className={styles.subtitle}>
            Kelola akun sosmed Official dan Sales yang terhubung ke AAOS
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Official Accounts</p>
        {official.length === 0 ? (
          <EmptyState title="Belum ada akun official terhubung" icon="🏢" />
        ) : (
          <div className={styles.rowList} data-testid="official-accounts-list">
            {official.map((account) => (
              <AccountRow key={account.id} account={account} onDisconnect={handleDisconnect} />
            ))}
          </div>
        )}
        <div>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={connectingOfficial}
            onClick={() => void handleConnectOfficial()}
          >
            {connectingOfficial ? "Menghubungkan..." : "+ Hubungkan Akun Official"}
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Sales Personal Accounts</p>
        {sales.length === 0 ? (
          <EmptyState title="Belum ada akun sales terhubung" icon="👤" />
        ) : (
          <div className={styles.rowList} data-testid="sales-accounts-list">
            {sales.map((account) => (
              <AccountRow key={account.id} account={account} onDisconnect={handleDisconnect} />
            ))}
          </div>
        )}

        <div className={styles.card}>
          <p className={styles.cardTitle}>+ Hubungkan Akun Sales</p>
          <div className={styles.formGrid} style={{ maxWidth: "100%" }}>
            <div className={styles.formRow}>
              <label className={styles.formLabel} htmlFor="sales-human-id">
                Sales Human ID
              </label>
              <input
                id="sales-human-id"
                className={styles.input}
                value={salesHumanIdInput}
                onChange={(e) => setSalesHumanIdInput(e.target.value)}
                placeholder="ID sales dari Contacts/Branch Settings"
              />
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={generatingLink || salesHumanIdInput.trim().length === 0}
              onClick={() => void handleGenerateSalesLink()}
              style={{ alignSelf: "flex-start" }}
            >
              {generatingLink ? "Membuat link..." : "Generate Link"}
            </button>
            {linkError !== undefined ? <ErrorCard message={linkError} /> : null}
            {generatedLink !== undefined ? (
              <div className={styles.card} data-testid="generated-connect-link">
                <p className={styles.rowDetail}>
                  Kirim link ini ke sales via WhatsApp (berlaku sampai{" "}
                  {formatDateId(generatedLink.expiresAt)}):
                </p>
                <p className={styles.captionBox}>{generatedLink.connectUrl}</p>
                <a
                  className={styles.linkButton}
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Hubungkan akun sosmed Anda ke AAOS: ${generatedLink.connectUrl}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  📤 Kirim via WA
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountRow({
  account,
  onDisconnect,
}: {
  readonly account: SosmedAccountDto;
  readonly onDisconnect: (id: string) => void;
}): React.ReactElement {
  return (
    <div className={styles.row}>
      <div className={styles.rowMeta}>
        <p className={styles.rowTitle}>
          <span
            className={styles.platformBadge}
            style={{ background: PLATFORM_COLOR[account.platform] }}
          >
            {PLATFORM_LABEL[account.platform]}
          </span>{" "}
          {account.accountName}
          {account.username !== undefined ? ` (@${account.username})` : ""}
        </p>
        <p className={styles.rowDetail}>
          {formatNumber(account.followerCount)} followers · Token: {account.maskedAccessToken} ·{" "}
          {account.status === "CONNECTED"
            ? "🟢 Connected"
            : account.status === "EXPIRED"
              ? "🟡 Token expired"
              : "🔴 Error"}
        </p>
      </div>
      <div className={styles.rowActions}>
        <button
          type="button"
          className={styles.dangerLinkButton}
          onClick={() => onDisconnect(account.id)}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
