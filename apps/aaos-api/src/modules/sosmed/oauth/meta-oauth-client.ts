import { ErrorCode } from "@aos/common";
import { err, ok, type Result } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";
import { z } from "zod";

const GRAPH_BASE_URL = "https://graph.facebook.com";
const DIALOG_BASE_URL = "https://www.facebook.com";
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Real Meta OAuth/Graph API endpoint shapes this client implements (AAOS-SOSMED-AUTOMATION Phase
 * 4). Verified against Meta's current developer docs before writing this file — same discipline
 * `MetaGraphApiTypes.ts` (Phase 2) already established:
 *
 * 1. `GET {DIALOG_BASE_URL}/{version}/dialog/oauth` — the real, documented "manual login flow"
 *    consent-screen redirect (Facebook Login's OAuth 2.0 authorization endpoint; stable for years,
 *    unchanged in the current docs).
 * 2. `GET {GRAPH_BASE_URL}/{version}/oauth/access_token` with `client_id`+`redirect_uri`+
 *    `client_secret`+`code` — exchanges the authorization code for a short-lived user access
 *    token. Same base endpoint as (3) below, distinguished only by which params are supplied
 *    (no `grant_type` on this call, per Meta's documented convention).
 * 3. `GET {GRAPH_BASE_URL}/{version}/oauth/access_token` with `grant_type=fb_exchange_token`+
 *    `client_id`+`client_secret`+`fb_exchange_token` — exchanges a short-lived user token for a
 *    long-lived one (~60 days). Verified directly against Meta's "Get a Long-Lived Access Token"
 *    guide (fetched 2026-08-24): exact param names and response shape (`access_token`/`token_type`/
 *    `expires_in`) confirmed there.
 * 4. `GET {GRAPH_BASE_URL}/{version}/me/accounts` with `access_token` — lists every Page the user
 *    manages, each with its OWN long-lived Page access token (`data[].access_token`) that does not
 *    itself carry an `expires_in` — also verified against the same guide: "Long-lived page tokens
 *    have no expiration date" when derived from a long-lived user token via this endpoint.
 * 5. `GET {GRAPH_BASE_URL}/{version}/{page-id}?fields=instagram_business_account` with
 *    `access_token` (the Page's own token) — the real, documented way to discover the IG Business
 *    Account id linked to a connected FB Page (Instagram Graph API "Get Started" guide's account
 *    linking model: an IG Business/Creator account must be linked to a Page before its
 *    `instagram_business_account` field is populated).
 *
 * Permission scopes requested by this client's `buildAuthorizeUrl` — verified against Meta's
 * current Permissions Reference before use, per the coordinator note's explicit instruction not to
 * copy the spec's literal list unchecked:
 *   - `pages_show_list` — REQUIRED to enumerate Pages via `/me/accounts` at all; the spec's literal
 *     list omitted it, but without it `/me/accounts` returns an empty list even for a user who
 *     manages Pages. Added deliberately, not silently dropped.
 *   - `pages_manage_posts`, `pages_read_engagement` — Page content-publishing + read permissions,
 *     matching the spec.
 *   - `instagram_basic`, `instagram_content_publish` — IG Business account read + content-publish
 *     permissions, matching the spec. (`instagram_business_content_publish` also exists in current
 *     docs as a newer/alternate name in some app review flows; `instagram_content_publish` remains
 *     the standard, documented permission for this exact use case and is what this client uses.)
 */
export const OAUTH_SCOPES: readonly string[] = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
];

export class MetaOAuthError extends AosError {
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

const ManagedPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  access_token: z.string(),
  category: z.string().optional(),
});

const ManagedPagesResponseSchema = z.object({
  data: z.array(ManagedPageSchema),
});

const InstagramBusinessAccountFieldSchema = z.object({
  id: z.string(),
  instagram_business_account: z.object({ id: z.string() }).optional(),
});

export interface OAuthTokenResult {
  readonly accessToken: string;
  readonly expiresInSeconds?: number;
}

export interface ManagedPage {
  readonly pageId: string;
  readonly pageName: string;
  readonly pageAccessToken: string;
  readonly instagramBusinessAccountId?: string;
}

export interface MetaOAuthClientOptions {
  readonly appId: string;
  readonly appSecret: string;
  readonly apiVersion: string;
  readonly timeoutMs?: number;
  /** Injectable `fetch` implementation — defaults to the global native `fetch`; overridable for tests. */
  readonly fetchImpl?: typeof fetch;
}

/**
 * `fetch`-based Meta OAuth/Graph API client for the authorization-code exchange flow. Mirrors
 * `MetaGraphApiClient`'s discipline (Phase 2) on purpose — never throws, every failure mode
 * (network, non-2xx, schema mismatch) becomes a `Result.err(MetaOAuthError)` — but is deliberately
 * kept as a plain module-local class rather than a full separate `@aos/*` package with its own
 * rate-limiter/retry/tracer composition root.
 *
 * Judgment call, documented rather than silently made: the coordinator note suggested mirroring
 * `meta-organic-connector`'s full architecture (contract-first use cases, rate limiter, retry) in a
 * genuinely separate package. Given this phase's size and risk, this client instead stays
 * module-local — the OAuth flow is a handful of one-shot, user-interactive calls (never a
 * high-volume/retry-prone publishing loop the way `PublishFacebookPost`/insights sync are), so a
 * rate limiter/retry wrapper adds real complexity for little real benefit here. The `Result<T,E>`/
 * zero-throw/Zod-validated-response discipline that actually matters for correctness IS preserved.
 * Promoting this to a full `@aos/meta-oauth-connector` package remains a clean, behavior-preserving
 * follow-up if a later phase needs it (e.g. token refresh automation).
 */
export class MetaOAuthClient {
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: MetaOAuthClientOptions) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** Builds the real `dialog/oauth` consent-screen URL — see class doc item 1. */
  buildAuthorizeUrl(params: { readonly redirectUri: string; readonly state: string }): string {
    const url = new URL(`${DIALOG_BASE_URL}/${this.options.apiVersion}/dialog/oauth`);
    url.searchParams.set("client_id", this.options.appId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("state", params.state);
    url.searchParams.set("scope", OAUTH_SCOPES.join(","));
    url.searchParams.set("response_type", "code");
    return url.toString();
  }

  /** `GET .../oauth/access_token` (code -> short-lived user token) — see class doc item 2. */
  async exchangeCodeForToken(params: {
    readonly code: string;
    readonly redirectUri: string;
  }): Promise<Result<OAuthTokenResult, MetaOAuthError>> {
    const url = new URL(`${GRAPH_BASE_URL}/${this.options.apiVersion}/oauth/access_token`);
    url.searchParams.set("client_id", this.options.appId);
    url.searchParams.set("client_secret", this.options.appSecret);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("code", params.code);
    return this.fetchToken(url);
  }

  /** `GET .../oauth/access_token?grant_type=fb_exchange_token` (short-lived -> long-lived user token) — see class doc item 3. */
  async exchangeForLongLivedToken(params: {
    readonly shortLivedToken: string;
  }): Promise<Result<OAuthTokenResult, MetaOAuthError>> {
    const url = new URL(`${GRAPH_BASE_URL}/${this.options.apiVersion}/oauth/access_token`);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", this.options.appId);
    url.searchParams.set("client_secret", this.options.appSecret);
    url.searchParams.set("fb_exchange_token", params.shortLivedToken);
    return this.fetchToken(url);
  }

  /**
   * `GET /me/accounts` (managed Pages + their own Page access tokens) followed by, for each Page,
   * `GET /{page-id}?fields=instagram_business_account` (linked IG Business account, if any) — see
   * class doc items 4-5. Returns one `ManagedPage` per Page the user manages; a Page with no linked
   * IG Business account simply omits `instagramBusinessAccountId`, never a fabricated value.
   */
  async getManagedPages(params: {
    readonly userAccessToken: string;
  }): Promise<Result<readonly ManagedPage[], MetaOAuthError>> {
    const url = new URL(`${GRAPH_BASE_URL}/${this.options.apiVersion}/me/accounts`);
    url.searchParams.set("access_token", params.userAccessToken);
    const responseResult = await this.doFetch(url);
    if (!responseResult.ok) {
      return responseResult;
    }
    const parsed = await this.parseBody(responseResult.value, ManagedPagesResponseSchema);
    if (!parsed.ok) {
      return parsed;
    }

    const pages: ManagedPage[] = [];
    for (const page of parsed.value.data) {
      const igResult = await this.getInstagramBusinessAccountId(page.id, page.access_token);
      pages.push({
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        ...(igResult.ok && igResult.value !== undefined
          ? { instagramBusinessAccountId: igResult.value }
          : {}),
      });
    }
    return ok(pages);
  }

  private async getInstagramBusinessAccountId(
    pageId: string,
    pageAccessToken: string,
  ): Promise<Result<string | undefined, MetaOAuthError>> {
    const url = new URL(`${GRAPH_BASE_URL}/${this.options.apiVersion}/${pageId}`);
    url.searchParams.set("fields", "instagram_business_account");
    url.searchParams.set("access_token", pageAccessToken);
    const responseResult = await this.doFetch(url);
    if (!responseResult.ok) {
      return responseResult;
    }
    const parsed = await this.parseBody(responseResult.value, InstagramBusinessAccountFieldSchema);
    if (!parsed.ok) {
      return parsed;
    }
    return ok(parsed.value.instagram_business_account?.id);
  }

  private async fetchToken(url: URL): Promise<Result<OAuthTokenResult, MetaOAuthError>> {
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

  private async doFetch(url: URL): Promise<Result<Response, MetaOAuthError>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url.toString(), {
        method: "GET",
        signal: controller.signal,
      });
      if (!response.ok) {
        return err(await this.toMetaOAuthError(response));
      }
      return ok(response);
    } catch (cause) {
      return err(
        new MetaOAuthError(`Meta OAuth/Graph API network failure: ${describeCause(cause)}`, {
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
  ): Promise<Result<T, MetaOAuthError>> {
    let json: unknown;
    try {
      json = await response.json();
    } catch (cause) {
      return err(
        new MetaOAuthError(
          `Meta OAuth/Graph API returned a non-JSON response body: ${describeCause(cause)}`,
          { cause },
        ),
      );
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return err(
        new MetaOAuthError("Meta OAuth/Graph API response failed schema validation", {
          context: { zodError: parsed.error },
        }),
      );
    }
    return ok(parsed.data);
  }

  private async toMetaOAuthError(response: Response): Promise<MetaOAuthError> {
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
    return new MetaOAuthError(message, { context: { httpStatus: response.status } }, code);
  }
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
