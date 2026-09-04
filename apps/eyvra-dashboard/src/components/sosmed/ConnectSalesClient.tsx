"use client";

import { useEffect, useState } from "react";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { OAuthStartResponseDto } from "@/types/sosmed.types";

export interface ConnectSalesClientProps {
  readonly token: string;
}

/**
 * `/connect/sales/:token`'s client half — calls the real, public
 * `GET /api/sosmed/public/connect/:token/start` (which proxies `aaos-api`'s real
 * `GET /api/v1/sosmed/oauth/sales/:token/start`) and redirects the sales human's browser straight
 * to the returned `authorizeUrl` (Meta's real consent screen). Handles the real error cases
 * honestly — an expired/already-used token returns a real non-2xx from `SosmedOAuthService`'s
 * `requireRedeemableConnectToken`, surfaced here as a plain Indonesian message, never a silent
 * redirect loop or a fabricated "success" state.
 */
export function ConnectSalesClient({ token }: ConnectSalesClientProps): React.ReactElement {
  const [error, setError] = useState<string | undefined>(undefined);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start(): Promise<void> {
      const response = await fetch(`/api/sosmed/public/connect/${encodeURIComponent(token)}/start`);
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => undefined)) as
          { error?: { message?: string } } | undefined;
        setError(
          body?.error?.message ??
            "Link ini sudah tidak berlaku (kedaluwarsa atau sudah dipakai). Minta link baru ke manager Anda.",
        );
        return;
      }
      const body = (await response.json()) as OAuthStartResponseDto;
      setRedirecting(true);
      window.location.href = body.authorizeUrl;
    }
    void start();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }

  return (
    <div data-testid="connect-sales-loading">
      <LoadingSpinner />
      <p style={{ textAlign: "center", marginTop: 12, fontSize: 13, color: "var(--gray-500)" }}>
        {redirecting
          ? "Mengarahkan ke halaman login Facebook..."
          : "Menghubungkan akun sosmed Anda ke AAOS..."}
      </p>
    </div>
  );
}
