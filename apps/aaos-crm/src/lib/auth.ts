import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

export interface SessionInfo {
  readonly userId: string;
  readonly email?: string;
  /** The sales human's own id in `@aos/lead-store`/`@aos/branch-manager` terms — read from Supabase Auth `user_metadata.salesHumanId`, set at account provisioning time. Falls back to `userId` when unset (a reasonable default for a fresh account, never `undefined`, since every claim/closing/stats call needs a concrete id). */
  readonly salesHumanId: string;
  readonly branchId?: string;
}

function requireSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url === undefined || url.length === 0) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (anonKey === undefined || anonKey.length === 0) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  }
  return { url, anonKey };
}

/**
 * A Supabase client that reads/writes the auth session via `request`/`response` cookies — the
 * `@supabase/ssr` pattern for Next.js Edge middleware, mirrors `apps/aaos-dashboard`'s
 * `lib/auth.ts`.
 */
export function createSupabaseMiddlewareClient(
  request: NextRequest,
  response: NextResponse,
): ReturnType<typeof createServerClient> {
  const { url, anonKey } = requireSupabaseEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: Record<string, unknown>) {
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });
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
 * Resolves the current session (if any) from `request`'s cookies, mutating `response` with any
 * refreshed auth cookies `@supabase/ssr` decides to issue. Returns `null` for no session — never
 * throws for the "not logged in" case (that's an expected, not exceptional, outcome).
 */
export async function getSession(
  request: NextRequest,
  response: NextResponse,
): Promise<SessionInfo | null> {
  const supabase = createSupabaseMiddlewareClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) {
    return null;
  }
  const metadata = user.user_metadata as Record<string, unknown> | null;
  return {
    userId: user.id,
    email: user.email,
    salesHumanId: extractSalesHumanId(user.id, metadata),
    branchId: extractBranchId(metadata),
  };
}
