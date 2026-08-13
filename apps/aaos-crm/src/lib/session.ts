"use client";

import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "./supabase";

export interface ClientSession {
  readonly userId: string;
  readonly email?: string;
  readonly salesHumanId: string;
  readonly branchId?: string;
}

function extractSalesHumanId(userId: string, metadata: Record<string, unknown> | null): string {
  const raw = metadata?.["salesHumanId"];
  return typeof raw === "string" && raw.length > 0 ? raw : userId;
}

function extractBranchId(metadata: Record<string, unknown> | null): string | undefined {
  const raw = metadata?.["branchId"];
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

/**
 * Client-side hook reading the current Supabase Auth session directly (the same "talk to
 * Supabase directly" exception `lib/supabase.ts`/`lib/realtime.ts` use — coordinator note #1).
 * Every page that needs "this sales human's own id" (claim, closing, my-leads, stats) uses this
 * instead of re-deriving it from `apps/aaos-api`.
 */
export function useSalesSession(): { session: ClientSession | undefined; loading: boolean } {
  const [session, setSession] = useState<ClientSession | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) {
        return;
      }
      const user = data.user;
      if (user === null) {
        setSession(undefined);
      } else {
        const metadata = user.user_metadata as Record<string, unknown> | null;
        setSession({
          userId: user.id,
          email: user.email,
          salesHumanId: extractSalesHumanId(user.id, metadata),
          branchId: extractBranchId(metadata),
        });
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { session, loading };
}
