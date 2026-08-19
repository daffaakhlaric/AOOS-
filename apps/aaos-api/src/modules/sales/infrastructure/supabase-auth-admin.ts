import { createClient } from "@supabase/supabase-js";

/** Raw shape of a Supabase Auth user record this module actually reads (a small structural subset of `@supabase/supabase-js`'s real `User` type). */
export interface SupabaseAuthUserLike {
  readonly id: string;
  readonly email?: string;
  readonly last_sign_in_at?: string | null;
  readonly user_metadata?: Record<string, unknown> | null;
}

export interface SupabaseAuthAdminError {
  readonly message: string;
  readonly status?: number;
}

export interface CreateSupabaseAuthUserInput {
  readonly email: string;
  readonly password: string;
  readonly email_confirm: boolean;
  readonly user_metadata: Record<string, unknown>;
}

export interface UpdateSupabaseAuthUserInput {
  readonly email?: string;
  readonly password?: string;
  readonly user_metadata?: Record<string, unknown>;
}

/** Input for `auth.admin.generateLink` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY's "Login as Tenant" impersonation — coordinator note #1's chosen mechanism). */
export interface GenerateLinkInput {
  readonly type: "magiclink";
  readonly email: string;
  readonly options?: { readonly redirectTo?: string };
}

/** The one field this module actually reads from `generateLink`'s response — Supabase's real response nests it under `properties.action_link`. */
export interface GenerateLinkResult {
  readonly properties: { readonly action_link: string };
}

/**
 * A minimal, hand-written structural port over `@supabase/supabase-js`'s `SupabaseClient.auth.admin`
 * — the Admin API this module calls to provision/update the real Supabase Auth user backing a
 * `sales_humans` row (coordinator note #1). Mirrors `@aos/lead-store`'s `SupabaseClientLike`
 * discipline: repositories/services depend on THIS narrow interface, never the real library's
 * complex generic type, so tests can inject a hand-rolled fake.
 */
export interface SupabaseAuthAdminLike {
  readonly auth: {
    readonly admin: {
      createUser(input: CreateSupabaseAuthUserInput): Promise<{
        data: { user: SupabaseAuthUserLike } | null;
        error: SupabaseAuthAdminError | null;
      }>;
      updateUserById(
        userId: string,
        input: UpdateSupabaseAuthUserInput,
      ): Promise<{
        data: { user: SupabaseAuthUserLike } | null;
        error: SupabaseAuthAdminError | null;
      }>;
      getUserById(userId: string): Promise<{
        data: { user: SupabaseAuthUserLike } | null;
        error: SupabaseAuthAdminError | null;
      }>;
      listUsers(params?: { readonly page?: number; readonly perPage?: number }): Promise<{
        data: { users: readonly SupabaseAuthUserLike[] } | null;
        error: SupabaseAuthAdminError | null;
      }>;
      generateLink(input: GenerateLinkInput): Promise<{
        data: GenerateLinkResult | null;
        error: SupabaseAuthAdminError | null;
      }>;
    };
  };
}

/**
 * Factory for the real Supabase Auth Admin client, bridged to `SupabaseAuthAdminLike` at this
 * single composition boundary (mirrors `@aos/lead-store`'s `SupabaseClient.ts`'s `unknown`-mediated
 * cast discipline — never `any`). MUST be constructed with the service-role key (`SUPABASE_SERVICE_KEY`)
 * — the Admin API rejects the anon key.
 */
export function createSupabaseAuthAdminClient(
  url: string,
  serviceKey: string,
): SupabaseAuthAdminLike {
  const client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client as unknown as SupabaseAuthAdminLike;
}
