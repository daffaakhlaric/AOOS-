import { randomBytes, randomUUID } from "node:crypto";

import type { SupabaseClientLike } from "@aos/lead-store";

const TABLE = "sosmed_connect_tokens";
const TOKEN_BYTES = 32;

/** Raw `sosmed_connect_tokens` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/015_sosmed_oauth.sql`. */
export interface SosmedConnectTokenRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly token: string;
  readonly sales_human_id: string;
  readonly expires_at: string;
  readonly used_at: string | null;
  readonly created_at: string;
}

export class SosmedConnectTokenRepositoryError extends Error {}

/**
 * Generates a fresh single-use connect-link token — 32 random bytes (256 bits), hex-encoded.
 * Deliberately NOT a UUID: this value is a bearer-style secret sent over WhatsApp to a sales
 * human's phone (the spec's `/connect/sales/:token` link) — a leaked/guessed link before use is a
 * real account-takeover-adjacent risk (coordinator note point 2), so it gets the same treatment as
 * `OAuthStateStore`'s `state` param, not a UUID v4's lower (122-bit) guessing-resistance.
 */
export function generateConnectToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

/**
 * Supabase-backed persistence for `sosmed_connect_tokens` (AAOS-SOSMED-AUTOMATION Phase 4) — the
 * real, durable, single-use, expiring token record backing the "Hubungkan Akun Sales" connect-link
 * flow. See `supabase/migrations/015_sosmed_oauth.sql`'s own doc comment for the full security
 * reasoning on why this is a real DB row (`expires_at`/`used_at`/`sales_human_id`) rather than a
 * bare random UUID.
 *
 * `markUsed` is called ONLY after a successful OAuth token exchange completes
 * (`SosmedOAuthService.handleSalesCallback`) — never at link creation, never merely on starting the
 * redirect — so an abandoned or failed OAuth attempt never burns the link, per the spec's explicit
 * requirement.
 */
export class SosmedConnectTokenRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async create(input: {
    readonly tenantId: string;
    readonly salesHumanId: string;
    readonly expiresAt: string;
  }): Promise<SosmedConnectTokenRow> {
    const { data, error } = await this.client
      .from<SosmedConnectTokenRow>(TABLE)
      .insert({
        id: randomUUID(),
        tenant_id: input.tenantId,
        token: generateConnectToken(),
        sales_human_id: input.salesHumanId,
        expires_at: input.expiresAt,
        used_at: null,
      })
      .select("*")
      .single();
    if (error !== null || data === null) {
      throw new SosmedConnectTokenRepositoryError(
        `SosmedConnectTokenRepository.create failed: ${error?.message ?? "no row returned"}`,
      );
    }
    return data;
  }

  async findByToken(token: string): Promise<SosmedConnectTokenRow | undefined> {
    const { data, error } = await this.client
      .from<SosmedConnectTokenRow>(TABLE)
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (error !== null) {
      throw new SosmedConnectTokenRepositoryError(
        `SosmedConnectTokenRepository.findByToken failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }

  async findById(id: string): Promise<SosmedConnectTokenRow | undefined> {
    const { data, error } = await this.client
      .from<SosmedConnectTokenRow>(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error !== null) {
      throw new SosmedConnectTokenRepositoryError(
        `SosmedConnectTokenRepository.findById failed: ${error.message}`,
      );
    }
    return data ?? undefined;
  }

  /** Marks the token used — see class doc for why this happens ONLY post-exchange, never earlier. */
  async markUsed(id: string, usedAtIso: string): Promise<void> {
    const { error } = await this.client
      .from<SosmedConnectTokenRow>(TABLE)
      .update({ used_at: usedAtIso })
      .eq("id", id);
    if (error !== null) {
      throw new SosmedConnectTokenRepositoryError(
        `SosmedConnectTokenRepository.markUsed failed: ${error.message}`,
      );
    }
  }
}
