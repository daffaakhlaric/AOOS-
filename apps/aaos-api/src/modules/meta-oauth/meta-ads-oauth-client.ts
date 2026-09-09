import { err, ok, type Result } from "@aos/common";
import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";
import { z } from "zod";

const GRAPH_BASE_URL = "https://graph.facebook.com";
const DIALOG_BASE_URL = "https://www.facebook.com";
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Real Facebook Login (Meta Ads scope) OAuth endpoints this client implements (Sprint 2 —
 * EYVRA-META-OAUTH-WHATSAPP-SETUP). Deliberately a SEPARATE, module-local client from
 * `modules/sosmed/oauth/meta-oauth-client.ts` — same underlying Meta OAuth endpoints, but a
 * genuinely different scope list (`ads_management`/`ads_read`/`business_management`, never
 * `pages_show_list`/`instagram_*`) and a different post-token discovery call (`/me/adaccounts`,
 * never `/me/accounts`+per-Page IG lookup) — sharing one class across both would conflate two
 * unrelated consent flows behind one `buildAuthorizeUrl`. The `Result<T,E>`/zero-throw/
 * Zod-validated-response/`AbortController`-timeout discipline is copied verbatim from that class
 * (already-audited, real, working) rather than reinvented.
 *
 * 1. `GET {DIALOG_BASE_URL}/{version}/dialog/oauth` — Facebook Login's OAuth 2.0 authorization
 *    endpoint.
 * 2. `GET {GRAPH_BASE_URL}/{version}/oauth/access_token` (code -> short-lived user token).
 * 3. `GET {GRAPH_BASE_URL}/{version}/oauth/access_token?grant_type=fb_exchange_token`
 *    (short-lived -> long-lived user token, ~60 days).
 * 4. `GET {GRAPH_BASE_URL}/{version}/me?fields=id,name` — the authenticated user's own Meta
 *    identity (`fb_user_id`/`fb_user_name`).
 * 5. `GET {GRAPH_BASE_URL}/{version}/me/adaccounts?fields=account_id,name,currency,timezone_name`
 *    — every ad account the user can manage.
 */
export const META_ADS_OAUTH_SCOPES: readonly string[] = [
  "ads_management",
  "ads_read",
  "business_management",
];

export class MetaAdsOAuthError extends AosError {
  constructor(
    message: string,
    options: AosErrorOptions = {},
    code: ErrorCode = ErrorCode.UNAVAILABLE,
  ) {
    super(code, message, options);
  }
}

const OAuthTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
});

const MeResponseSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});

const AdAccountSchema = z.object({
  account_id: z.string().optional(),
  id: z.string(),
  name: z.string().optional(),
  currency: z.string().optional(),
  timezone_name: z.string().optional(),
});

const AdAccountsResponseSchema = z.object({
  data: z.array(AdAccountSchema),
});

export interface OAuthTokenResult {
  readonly accessToken: string;
  readonly expiresInSeconds?: number;
}

export interface MetaIdentity {
  readonly fbUserId: string;
  readonly fbUserName: string | undefined;
}

export interface MetaAdAccount {
  readonly adAccountId: string;
  readonly name: string | undefined;
  readonly currency: string | undefined;
  readonly timezoneName: string | undefined;
}

export interface MetaAdsOAuthClientOptions {
  readonly appId: string;
  readonly appSecret: string;
  readonly apiVersion: string;
  readonly timeoutMs?: number;
  /** Injectable `fetch` implementation — defaults to the global native `fetch`; overridable for tests. */
  readonly fetchImpl?: typeof fetch;
}

export class MetaAdsOAuthClient {
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: MetaAdsOAuthClientOptions) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  buildAuthorizeUrl(params: { readonly redirectUri: string; readonly state: string }): string {
    const url = new URL(`${DIALOG_BASE_URL}/${this.options.apiVersion}/dialog/oauth`);
    url.searchParams.set("client_id", this.options.appId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("state", params.state);
    url.searchParams.set("scope", META_ADS_OAUTH_SCOPES.join(","));
    url.searchParams.set("response_type", "code");
    return url.toString();
  }

  async exchangeCodeForToken(params: {
    readonly code: string;
    readonly redirectUri: string;
  }): Promise<Result<OAuthTokenResult, MetaAdsOAuthError>> {
    const url = new URL(`${GRAPH_BASE_URL}/${this.options.apiVersion}/oauth/access_token`);
    url.searchParams.set("client_id", this.options.appId);
    url.searchParams.set("client_secret", this.options.appSecret);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("code", params.code);
    return this.fetchToken(url);
  }

  async exchangeForLongLivedToken(params: {
    readonly shortLivedToken: string;
  }): Promise<Result<OAuthTokenResult, MetaAdsOAuthError>> {
    const url = new URL(`${GRAPH_BASE_URL}/${this.options.apiVersion}/oauth/access_token`);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", this.options.appId);
    url.searchParams.set("client_secret", this.options.appSecret);
    url.searchParams.set("fb_exchange_token", params.shortLivedToken);
    return this.fetchToken(url);
  }

  async getMe(params: {
    readonly accessToken: string;
  }): Promise<Result<MetaIdentity, MetaAdsOAuthError>> {
    const url = new URL(`${GRAPH_BASE_URL}/${this.options.apiVersion}/me`);
    url.searchParams.set("fields", "id,name");
    url.searchParams.set("access_token", params.accessToken);
    const responseResult = await this.doFetch(url);
    if (!responseResult.ok) {
      return responseResult;
    }
    const parsed = await this.parseBody(responseResult.value, MeResponseSchema);
    if (!parsed.ok) {
      return parsed;
    }
    return ok({ fbUserId: parsed.value.id, fbUserName: parsed.value.name });
  }

  async getAdAccounts(params: {
    readonly accessToken: string;
  }): Promise<Result<readonly MetaAdAccount[], MetaAdsOAuthError>> {
    const url = new URL(`${GRAPH_BASE_URL}/${this.options.apiVersion}/me/adaccounts`);
    url.searchParams.set("fields", "account_id,name,currency,timezone_name");
    url.searchParams.set("access_token", params.accessToken);
    const responseResult = await this.doFetch(url);
    if (!responseResult.ok) {
      return responseResult;
    }
    const parsed = await this.parseBody(responseResult.value, AdAccountsResponseSchema);
    if (!parsed.ok) {
      return parsed;
    }
    return ok(
      parsed.value.data.map((row) => ({
        // Meta's real `/me/adaccounts` returns `id` as `"act_<account_id>"` — `account_id` (the
        // bare numeric id, if present) is what every other real Meta Ads call site in this app
        // (`MetaAdsConnectorConfig.adAccountIds`, `tenants.meta_ad_account_id`) actually stores;
        // fall back to `id` only on the rare shape where `account_id` is absent.
        adAccountId: row.account_id ?? row.id,
        name: row.name,
        currency: row.currency,
        timezoneName: row.timezone_name,
      })),
    );
  }

  private async fetchToken(url: URL): Promise<Result<OAuthTokenResult, MetaAdsOAuthError>> {
    const responseResult = await this.doFetch(url);
    if (!responseResult.ok) {
      return responseResult;
    }
    const parsed = await this.parseBody(responseResult.value, OAuthTokenResponseSchema);
    if (!parsed.ok) {
      return parsed;
    }
    return ok({
      accessToken: parsed.value.access_token,
      ...(parsed.value.expires_in !== undefined
        ? { expiresInSeconds: parsed.value.expires_in }
        : {}),
    });
  }

  private async doFetch(url: URL): Promise<Result<Response, MetaAdsOAuthError>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url.toString(), {
        method: "GET",
        signal: controller.signal,
      });
      if (!response.ok) {
        return err(await this.toMetaAdsOAuthError(response));
      }
      return ok(response);
    } catch (cause) {
      return err(
        new MetaAdsOAuthError(`Meta OAuth/Graph API network failure: ${describeCause(cause)}`, {
          cause,
        }),
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parseBody<T>(
    response: Response,
    schema: {
      safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: unknown };
    },
  ): Promise<Result<T, MetaAdsOAuthError>> {
    let json: unknown;
    try {
      json = await response.json();
    } catch (cause) {
      return err(
        new MetaAdsOAuthError(
          `Meta OAuth/Graph API returned a non-JSON response body: ${describeCause(cause)}`,
          { cause },
        ),
      );
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return err(
        new MetaAdsOAuthError("Meta OAuth/Graph API response failed schema validation", {
          context: { zodError: parsed.error },
        }),
      );
    }
    return ok(parsed.data);
  }

  private async toMetaAdsOAuthError(response: Response): Promise<MetaAdsOAuthError> {
    let message = `Meta OAuth/Graph API request failed with HTTP ${response.status}`;
    try {
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof (body as { error: unknown }).error === "object" &&
        (body as { error: { message?: unknown } }).error !== null
      ) {
        const nested = (body as { error: { message?: unknown } }).error.message;
        if (typeof nested === "string") {
          message = nested;
        }
      }
    } catch {
      // Non-JSON error body — fall back to the generic HTTP-status-only message above.
    }
    const code =
      response.status === 401 || response.status === 400
        ? ErrorCode.UNAUTHORIZED
        : ErrorCode.UNAVAILABLE;
    return new MetaAdsOAuthError(message, { context: { httpStatus: response.status } }, code);
  }
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
