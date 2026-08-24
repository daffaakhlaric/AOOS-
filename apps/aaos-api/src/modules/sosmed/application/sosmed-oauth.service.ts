import { randomUUID } from "node:crypto";

import { NotFoundError, UnavailableError, ValidationError } from "@aos/errors";
import { Inject, Injectable, Optional } from "@nestjs/common";

import type { AaosApiConfig } from "../../../config/aaos-api.config.js";
import { AAOS_API_CONFIG } from "../../../di-tokens.js";
import { SalesHumanRepository } from "../../sales/infrastructure/sales-human.repository.js";
import {
  toSosmedAccountDto,
  type CreateConnectLinkResponseDto,
  type OAuthCallbackQueryDto,
  type OAuthCallbackResponseDto,
  type OAuthStartResponseDto,
  type SosmedAccountResponseDto,
} from "../dto/sosmed-account.dto.js";
import type { SosmedAccountRow } from "../infrastructure/sosmed-account.repository.js";
import { SosmedAccountRepository } from "../infrastructure/sosmed-account.repository.js";
import type { SosmedConnectTokenRow } from "../infrastructure/sosmed-connect-token.repository.js";
import { SosmedConnectTokenRepository } from "../infrastructure/sosmed-connect-token.repository.js";
import type { ManagedPage } from "../oauth/meta-oauth-client.js";
import { MetaOAuthClient } from "../oauth/meta-oauth-client.js";
import { OAuthStateStore } from "../oauth/oauth-state-store.js";

/** How long a manager-generated "Hubungkan Akun Sales" link stays redeemable before it must be regenerated. */
const CONNECT_LINK_TTL_HOURS = 24;

/**
 * `modules/sosmed`'s real OAuth orchestration (AAOS-SOSMED-AUTOMATION Phase 4) — the FIRST OAuth
 * flow and the FIRST storage of a live, third-party-usable credential anywhere in this codebase
 * outside the already-established `waba_configs`/`tenants.meta_access_token` pattern (coordinator
 * note, written before any Phase 4 code existed).
 *
 * ---------------------------------------------------------------------------------------------
 * SECURITY-RELEVANT JUDGMENT CALLS MADE IN THIS FILE (each documented at its call site too):
 * ---------------------------------------------------------------------------------------------
 * 1. **Token storage**: `sosmed_accounts.access_token` is written as plain text via
 *    `SosmedAccountRepository`, relying entirely on Supabase's own at-rest encryption — the EXACT
 *    precedent already verified for `waba_configs.access_token`/`tenants.meta_access_token`
 *    (`WabaConfigRepository`/`SettingsService`, read directly before writing this file). Not
 *    stricter (no app-level encryption layer invented for this one table — that would be an
 *    inconsistent, unreviewed security posture relative to every other credential this app
 *    already stores) and not looser (still a real DB column with a real NOT NULL constraint, never
 *    logged — see `StoredSosmedAccount.accessToken`'s own doc from Phase 1).
 * 2. **CSRF `state`**: real, 256-bit random, single-use, server-validated on both flows
 *    (`OAuthStateStore`) — never a decorative/omitted param.
 * 3. **Sales connect-link token**: a real, durable, single-use, expiring DB row
 *    (`SosmedConnectTokenRepository`/`sosmed_connect_tokens`), NOT a bare UUID. Validated
 *    unexpired+unused BEFORE starting the OAuth redirect (`startSalesOAuth`) AND again at the
 *    callback (`handleSalesCallback`) — defense in depth, since real wall-clock time passes
 *    between those two calls (the user is on Meta's own consent screen in between). Marked `used`
 *    ONLY once the long-lived user token exchange actually succeeds — never at link creation,
 *    never merely on starting the redirect — so an abandoned or failed OAuth attempt never burns
 *    the link, per the spec's explicit requirement. A zero-managed-Pages outcome (the user granted
 *    consent but manages no Pages) still counts as "successful token exchange" for this purpose —
 *    it is a real, legitimate redemption of the link, not a failed attempt, so it still consumes
 *    it; the resulting `OAuthCallbackResponseDto.success: false` communicates the empty result
 *    honestly without leaving the link forever redeemable.
 * 4. **`sales_human_id` provenance**: NEVER accepted from the callback request itself — it travels
 *    only through the server-validated `OAuthStateStore` entry (bound to the connect-token row at
 *    `startSalesOAuth` time) and the re-fetched `sosmed_connect_tokens` row at callback time. A
 *    tampered client-supplied `salesHumanId` in the callback query string (there is none — this
 *    service never reads one) could otherwise let a caller attribute a connected account to an
 *    arbitrary sales human.
 * 5. **Instagram credential**: Meta's real account-linking model has NO separate "IG user access
 *    token" for this flow — a linked IG Business Account is published to using its linked FB
 *    Page's own Page access token (verified via `MetaOAuthClient`'s class doc / Meta's Instagram
 *    Platform docs). So the `sosmed_accounts` row created for `platform: "INSTAGRAM"` stores the
 *    SAME `page.pageAccessToken` as its `access_token` as the sibling `FACEBOOK` row for that same
 *    Page — this is Meta's real, documented credential model, not a bug/shortcut.
 * 6. **Meta-side revocation on disconnect**: deliberately NOT attempted — see `disconnectAccount`'s
 *    own doc for why this is an honest, documented gap rather than a fabricated call.
 * ---------------------------------------------------------------------------------------------
 *
 * Single-tenant discipline, same as every other service in this app (coordinator note point 3):
 * every method operates on `this.config.AAOS_TENANT_ID`.
 */
@Injectable()
export class SosmedOAuthService {
  private readonly client: MetaOAuthClient | undefined;

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    private readonly accounts: SosmedAccountRepository,
    private readonly connectTokens: SosmedConnectTokenRepository,
    private readonly salesHumans: SalesHumanRepository,
    private readonly stateStore: OAuthStateStore,
    // `@Optional()` — a bare `Function`-typed constructor param with only a default value still
    // gets a real DI resolution attempt from Nest without this (same precedent as
    // `SosmedPostsService.now`/`OAuthStateStore.now`).
    @Optional() private readonly now: () => Date = () => new Date(),
    // `@Optional()` test seam — never Nest-provided in real composition (`SosmedModule` never
    // registers a `MetaOAuthClient` provider); lets specs inject a `MetaOAuthClient` built with a
    // fake `fetchImpl` instead of exercising real network calls or reaching for a global `fetch`
    // mock, mirroring `SosmedPostsService`'s `now` override for the exact same reason.
    @Optional() metaOAuthClientOverride?: MetaOAuthClient,
  ) {
    if (metaOAuthClientOverride !== undefined) {
      this.client = metaOAuthClientOverride;
    } else if (config.META_APP_ID.length > 0 && config.META_APP_SECRET.length > 0) {
      this.client = new MetaOAuthClient({
        appId: config.META_APP_ID,
        appSecret: config.META_APP_SECRET,
        apiVersion: config.META_API_VERSION,
      });
    }
  }

  private get tenantId(): string {
    return this.config.AAOS_TENANT_ID;
  }

  private requireClient(): MetaOAuthClient {
    if (this.client === undefined) {
      throw new UnavailableError(
        "Meta OAuth belum dikonfigurasi — META_APP_ID/META_APP_SECRET belum diisi untuk tenant ini.",
      );
    }
    return this.client;
  }

  private requireRedirectBase(): string {
    if (this.config.AAOS_API_BASE_URL.length === 0) {
      throw new UnavailableError(
        "AAOS_API_BASE_URL belum dikonfigurasi — dibutuhkan untuk membangun redirect_uri OAuth Meta.",
      );
    }
    return this.config.AAOS_API_BASE_URL.replace(/\/+$/, "");
  }

  // ---------------------------------------------------------------------------------------------
  // Official account flow — manager-triggered (`ApiKeyGuard`-protected start; public callback).
  // ---------------------------------------------------------------------------------------------

  /** `GET /api/v1/sosmed/oauth/official/start`. */
  startOfficialOAuth(): OAuthStartResponseDto {
    const client = this.requireClient();
    const redirectUri = `${this.requireRedirectBase()}/api/v1/sosmed/oauth/official/callback`;
    const state = this.stateStore.issue({ kind: "OFFICIAL" });
    return { authorizeUrl: client.buildAuthorizeUrl({ redirectUri, state }) };
  }

  /** `GET /api/v1/sosmed/oauth/official/callback` — PUBLIC (Meta redirects the manager's own browser here). */
  async handleOfficialCallback(query: OAuthCallbackQueryDto): Promise<OAuthCallbackResponseDto> {
    const deniedOrMissing = this.checkDeniedOrMissing(query);
    if (deniedOrMissing !== undefined) {
      return deniedOrMissing;
    }
    const flow = this.stateStore.consume(query.state as string);
    if (flow === undefined || flow.kind !== "OFFICIAL") {
      return {
        success: false,
        message: "State OAuth tidak valid, sudah dipakai, atau kedaluwarsa.",
      };
    }

    const client = this.requireClient();
    const redirectUri = `${this.requireRedirectBase()}/api/v1/sosmed/oauth/official/callback`;
    const pagesResult = await this.exchangeCodeForPages(client, query.code as string, redirectUri);
    if (!pagesResult.ok) {
      return { success: false, message: pagesResult.message };
    }
    if (pagesResult.pages.length === 0) {
      return {
        success: false,
        message: "Login Meta berhasil, tapi akun ini tidak mengelola Page manapun.",
      };
    }

    const createdRows = await this.persistPages(pagesResult.pages, { accountType: "OFFICIAL" });
    return {
      success: true,
      message: `${createdRows.length} akun berhasil terhubung.`,
      connectedAccounts: createdRows.map(toSosmedAccountDto),
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Sales personal-account connect-link flow.
  // ---------------------------------------------------------------------------------------------

  /** `POST /api/v1/sosmed/oauth/sales/connect-links` — manager-only (`ApiKeyGuard`-protected). */
  async createSalesConnectLink(salesHumanId: string): Promise<CreateConnectLinkResponseDto> {
    const salesHuman = await this.salesHumans.findById(salesHumanId);
    if (salesHuman === undefined) {
      throw new NotFoundError(`No sales human found with id "${salesHumanId}"`);
    }
    const expiresAt = new Date(
      this.now().getTime() + CONNECT_LINK_TTL_HOURS * 60 * 60 * 1000,
    ).toISOString();
    const row = await this.connectTokens.create({
      tenantId: this.tenantId,
      salesHumanId,
      expiresAt,
    });
    const dashboardBase = this.config.AAOS_DASHBOARD_BASE_URL.replace(/\/+$/, "");
    const connectUrl = `${dashboardBase}/connect/sales/${row.token}`;
    return { token: row.token, expiresAt: row.expires_at, connectUrl };
  }

  /** `GET /api/v1/sosmed/oauth/sales/:token/start` — PUBLIC, gated only by the connect-link token itself. */
  async startSalesOAuth(token: string): Promise<OAuthStartResponseDto> {
    const client = this.requireClient();
    const row = await this.requireRedeemableConnectToken(token);
    const redirectUri = `${this.requireRedirectBase()}/api/v1/sosmed/oauth/sales/callback`;
    const state = this.stateStore.issue({
      kind: "SALES_PERSONAL",
      connectTokenId: row.id,
      salesHumanId: row.sales_human_id,
    });
    return { authorizeUrl: client.buildAuthorizeUrl({ redirectUri, state }) };
  }

  /** `GET /api/v1/sosmed/oauth/sales/callback` — PUBLIC (Meta redirects the sales human's own browser here). */
  async handleSalesCallback(query: OAuthCallbackQueryDto): Promise<OAuthCallbackResponseDto> {
    const deniedOrMissing = this.checkDeniedOrMissing(query);
    if (deniedOrMissing !== undefined) {
      return deniedOrMissing;
    }
    const flow = this.stateStore.consume(query.state as string);
    if (flow === undefined || flow.kind !== "SALES_PERSONAL") {
      return {
        success: false,
        message: "State OAuth tidak valid, sudah dipakai, atau kedaluwarsa.",
      };
    }

    // Defense in depth — re-validate the connect token is STILL redeemable now, not just when
    // `startSalesOAuth` issued the `state` (real wall-clock time passes on Meta's consent screen).
    let tokenRow;
    try {
      tokenRow = await this.requireRedeemableConnectToken(undefined, flow.connectTokenId);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      return { success: false, message };
    }

    const client = this.requireClient();
    const redirectUri = `${this.requireRedirectBase()}/api/v1/sosmed/oauth/sales/callback`;
    const pagesResult = await this.exchangeCodeForPages(client, query.code as string, redirectUri);
    if (!pagesResult.ok) {
      return { success: false, message: pagesResult.message };
    }

    // Successful token exchange (see class doc point 3) — consume the link now, regardless of how
    // many Pages came back, so it can never be redeemed a second time.
    await this.connectTokens.markUsed(tokenRow.id, this.now().toISOString());

    if (pagesResult.pages.length === 0) {
      return {
        success: false,
        message: "Login Meta berhasil, tapi akun ini tidak mengelola Page manapun.",
      };
    }

    const createdRows = await this.persistPages(pagesResult.pages, {
      accountType: "SALES_PERSONAL",
      salesHumanId: flow.salesHumanId,
    });
    return {
      success: true,
      message: `${createdRows.length} akun berhasil terhubung untuk sales human ini.`,
      connectedAccounts: createdRows.map(toSosmedAccountDto),
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Accounts — `GET /api/v1/sosmed/accounts`, `DELETE /api/v1/sosmed/accounts/:id`.
  // ---------------------------------------------------------------------------------------------

  async listAccounts(): Promise<readonly SosmedAccountResponseDto[]> {
    const rows = await this.accounts.listByTenant(this.tenantId);
    return rows.map(toSosmedAccountDto);
  }

  /**
   * `DELETE /api/v1/sosmed/accounts/:id`. Real, but LOCAL-ONLY disconnect — the row is genuinely
   * deleted from `sosmed_accounts`, so no future publish/schedule can use this credential again.
   *
   * Known, documented gap (per the task's explicit instruction to document rather than fabricate):
   * this does NOT call Meta's `DELETE /{user-id}/permissions` to revoke the grant server-side.
   * That real endpoint needs the Meta USER id and a USER (or app) access token; this table stores
   * PAGE access tokens (see class doc point 5) and never persists the underlying user id/user
   * token anywhere, by design (storing only what each publish call actually needs). Calling that
   * endpoint would require either (a) persisting an additional, more powerful user-scoped
   * credential purely to support revocation — widening this table's credential surface for a
   * secondary feature — or (b) a separate, unverified assumption about whether a Page access token
   * can revoke its own grant via that endpoint (it cannot, per Meta's documented permission model).
   * Left as a deferred follow-up rather than guessed at.
   */
  async disconnectAccount(id: string): Promise<void> {
    const row = await this.accounts.findById(id);
    if (row === undefined) {
      throw new NotFoundError(`No sosmed account found with id "${id}"`);
    }
    await this.accounts.deleteById(id);
  }

  // ---------------------------------------------------------------------------------------------
  // Shared helpers.
  // ---------------------------------------------------------------------------------------------

  private checkDeniedOrMissing(query: OAuthCallbackQueryDto): OAuthCallbackResponseDto | undefined {
    if (query.error !== undefined) {
      return {
        success: false,
        message: `Meta OAuth ditolak: ${query.error_description ?? query.error}`,
      };
    }
    if (query.code === undefined || query.state === undefined) {
      return { success: false, message: "Callback OAuth Meta tidak lengkap (code/state hilang)." };
    }
    return undefined;
  }

  private async exchangeCodeForPages(
    client: MetaOAuthClient,
    code: string,
    redirectUri: string,
  ): Promise<{ ok: true; pages: readonly ManagedPage[] } | { ok: false; message: string }> {
    const shortLived = await client.exchangeCodeForToken({ code, redirectUri });
    if (!shortLived.ok) {
      return {
        ok: false,
        message: `Gagal menukar authorization code: ${shortLived.error.message}`,
      };
    }
    const longLived = await client.exchangeForLongLivedToken({
      shortLivedToken: shortLived.value.accessToken,
    });
    if (!longLived.ok) {
      return {
        ok: false,
        message: `Gagal menukar token menjadi long-lived: ${longLived.error.message}`,
      };
    }
    const pages = await client.getManagedPages({ userAccessToken: longLived.value.accessToken });
    if (!pages.ok) {
      return { ok: false, message: `Gagal mengambil daftar Page: ${pages.error.message}` };
    }
    return { ok: true, pages: pages.value };
  }

  private async persistPages(
    pages: readonly ManagedPage[],
    attribution: {
      readonly accountType: "OFFICIAL" | "SALES_PERSONAL";
      readonly salesHumanId?: string;
    },
  ): Promise<SosmedAccountRow[]> {
    const created: SosmedAccountRow[] = [];
    for (const page of pages) {
      const fbRow = await this.accounts.insert({
        id: randomUUID(),
        tenantId: this.tenantId,
        ...(attribution.salesHumanId !== undefined
          ? { salesHumanId: attribution.salesHumanId }
          : {}),
        platform: "FACEBOOK",
        accountType: attribution.accountType,
        accountName: page.pageName,
        pageId: page.pageId,
        accessToken: page.pageAccessToken,
      });
      created.push(fbRow);

      if (page.instagramBusinessAccountId !== undefined) {
        // Same Page access token — see class doc point 5 for why this is Meta's real credential
        // model, not a copy/paste mistake.
        const igRow = await this.accounts.insert({
          id: randomUUID(),
          tenantId: this.tenantId,
          ...(attribution.salesHumanId !== undefined
            ? { salesHumanId: attribution.salesHumanId }
            : {}),
          platform: "INSTAGRAM",
          accountType: attribution.accountType,
          accountName: page.pageName,
          instagramAccountId: page.instagramBusinessAccountId,
          accessToken: page.pageAccessToken,
        });
        created.push(igRow);
      }
    }
    return created;
  }

  private async requireRedeemableConnectToken(
    token?: string,
    id?: string,
  ): Promise<SosmedConnectTokenRow> {
    const row =
      token !== undefined
        ? await this.connectTokens.findByToken(token)
        : id !== undefined
          ? await this.connectTokens.findById(id)
          : undefined;
    if (row === undefined) {
      throw new NotFoundError("Link connect sales tidak ditemukan.");
    }
    if (row.used_at !== null) {
      throw new ValidationError("Link connect sales ini sudah pernah digunakan.");
    }
    if (new Date(row.expires_at).getTime() < this.now().getTime()) {
      throw new ValidationError("Link connect sales ini sudah kedaluwarsa.");
    }
    return row;
  }
}
