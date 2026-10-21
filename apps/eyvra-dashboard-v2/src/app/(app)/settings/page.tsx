"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/common/Card";
import { MetaDestinationPicker } from "@/components/settings/MetaDestinationPicker";

export default function SettingsPage(): React.ReactElement {
  const [workspace, setWorkspace] = useState<{
    email?: string;
    tenantId: string;
    vertical: string;
    role: string;
  }>();
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>();
  const [error, setError] = useState("");
  const [integrationError, setIntegrationError] = useState("");
  const [health, setHealth] = useState<{
    connectionStatus: string;
    credentialVersion?: number;
    credentialSource?: string;
    executionTier?: string;
    budgetWriteVerification: string;
    lastValidatedAt?: string;
    capabilities: Record<string, { state: string; reason: string }>;
    issues: string[];
  }>();
  const [healthError, setHealthError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/workspace", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        setWorkspace(await r.json());
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError("Informasi akun tidak dapat dimuat. Muat ulang untuk mencoba lagi.");
      });
    fetch("/api/integrations", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        setAccounts(await r.json());
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setIntegrationError("Koneksi Meta belum dapat diverifikasi. Silakan coba lagi nanti.");
      });
    fetch("/api/integrations/health", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        setHealth(await r.json());
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setHealthError(
            "Pemeriksaan kemampuan Meta belum berhasil. Muat ulang untuk mencoba lagi.",
          );
      });
    return () => controller.abort();
  }, []);
  return (
    <main>
      <Topbar
        title="Settings"
        subtitle="Akun dan workspace SkorPintar Ads Insight"
        userEmail={workspace?.email}
      />
      <div style={{ padding: 24, display: "grid", gap: 20, maxWidth: 960 }}>
        {error && <p role="alert">{error}</p>}
        <section id="profile">
          <Card title="Profile">
            <p>{workspace?.email ?? (error ? "Tidak tersedia" : "Memuat akun…")}</p>
            <p>Role: {workspace?.role ?? "—"}</p>
          </Card>
        </section>
        <section id="workspace">
          <Card title="Workspace">
            <p>{workspace?.tenantId ?? "—"}</p>
            <p>Vertical: {workspace?.vertical ?? "—"}</p>
            <Link href="/automation/growth-settings" style={{ color: "var(--brand)" }}>
              Buka Growth Settings →
            </Link>
          </Card>
        </section>
        <section id="integrations">
          <Card title="Integrations">
            <h3>Meta Ads</h3>
            {integrationError ? (
              <p role="alert">{integrationError}</p>
            ) : accounts === undefined ? (
              <p>Memeriksa akses akun…</p>
            ) : accounts.length ? (
              <ul>
                {accounts.map((a) => (
                  <li key={a.id}>
                    {a.name} · {a.id}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Belum ada akun iklan yang tersedia.</p>
            )}
            <p>
              Daftar ini menunjukkan akun yang dapat dibaca. Akses publish dan pembayaran diperiksa
              terpisah saat preflight campaign.
            </p>
            {healthError && <p role="alert">{healthError}</p>}
            {!health && !healthError && <p>Memverifikasi kemampuan integrasi…</p>}
            {health && (
              <>
                <p>
                  Status koneksi: <strong>{health.connectionStatus}</strong> ·{" "}
                  {health.executionTier ?? "READ_ONLY"}
                </p>
                <p>
                  Credential: {health.credentialSource ?? "—"} · versi{" "}
                  {health.credentialVersion ?? "—"}
                </p>
                <p>
                  Terakhir diperiksa:{" "}
                  {health.lastValidatedAt
                    ? new Date(health.lastValidatedAt).toLocaleString("id-ID")
                    : "Belum terverifikasi"}
                </p>
                <p>Validasi budget: {health.budgetWriteVerification}</p>
                <table style={{ width: "100%", textAlign: "left" }}>
                  <thead>
                    <tr>
                      <th>Kemampuan</th>
                      <th>Status</th>
                      <th>Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(health.capabilities).map(([action, cap]) => (
                      <tr key={action}>
                        <td>{action}</td>
                        <td>{cap.state}</td>
                        <td>{cap.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul>
                  {health.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </>
            )}
            <Link href="/campaigns" style={{ color: "var(--brand)" }}>
              Buka Campaigns →
            </Link>
            {["owner", "superadmin"].includes(workspace?.role ?? "") && <MetaDestinationPicker />}
          </Card>
        </section>
      </div>
    </main>
  );
}
