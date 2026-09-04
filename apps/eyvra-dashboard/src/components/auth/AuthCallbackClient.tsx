"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { createSupabaseBrowserClient } from "@/lib/supabase";

/**
 * `/auth/callback` — completes the real Supabase Auth magic-link sign-in
 * `SuperadminService.impersonate`'s `generateLink({ type: 'magiclink' })` mints (coordinator note
 * #1's chosen "Login as Tenant" mechanism). Supabase's hosted verify endpoint redirects the
 * browser here with `access_token`/`refresh_token` in the URL hash (implicit flow) — this page
 * reads that hash, calls `supabase.auth.setSession(...)` to actually persist the new (tenant
 * admin's) session into the SAME cookie storage `middleware.ts`/`lib/auth.ts` read, then redirects
 * to `/dashboard`. The hash is read client-side only (never sent to any server — `location.hash`
 * is not part of an HTTP request), matching Supabase's own documented implicit-flow pattern.
 */
export function AuthCallbackClient(): React.ReactElement {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function completeSignIn(): Promise<void> {
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken === null || refreshToken === null) {
        setError("Link login tidak valid atau sudah kedaluwarsa.");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (setSessionError) {
        setError(setSessionError.message);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    }
    void completeSignIn();
  }, [router]);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  return <LoadingSpinner />;
}
