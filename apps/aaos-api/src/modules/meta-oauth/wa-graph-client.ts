import { err, ok, type Result } from "@aos/common";
import { ErrorCode } from "@aos/common";
import { AosError, type AosErrorOptions } from "@aos/errors";
import { z } from "zod";

const GRAPH_BASE_URL = "https://graph.facebook.com";
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Real WhatsApp Business Embedded Signup Graph API calls this client implements (Sprint 2 —
 * EYVRA-META-OAUTH-WHATSAPP-SETUP). Same `Result<T,E>`/zero-throw/Zod-validated-response/
 * `AbortController`-timeout discipline as `meta-ads-oauth-client.ts` (this module's sibling) and
 * `modules/sosmed/oauth/meta-oauth-client.ts` (the original real precedent this whole file's shape
 * is copied from).
 *
 * 1. `GET {GRAPH_BASE_URL}/{version}/debug_token?input_token=&access_token=` — verifies a token
 *    handed back by the Embedded Signup JS SDK is genuinely a live Meta token before this app
 *    trusts it (Meta's own documented token-introspection endpoint).
 * 2. `GET {GRAPH_BASE_URL}/{version}/me/whatsapp_business_accounts` — the WABAs the signup token
 *    can manage.
 * 3. `GET {GRAPH_BASE_URL}/{version}/{wabaId}/phone_numbers` — phone numbers registered under a
 *    WABA.
 * 4. `POST {GRAPH_BASE_URL}/{version}/{wabaId}/subscribed_apps` — subscribes this app's webhook to
 *    the WABA's events (the real, documented final step of Embedded Signup before inbound webhook
 *    traffic starts flowing for that WABA).
 */
export class WaGraphError extends AosError {
  constructor(
    message: string,
    options: AosErrorOptions = {},
    code: ErrorCode = ErrorCode.UNAVAILABLE,
  ) {
    super(code, message, options);
  }
}

const DebugTokenResponseSchema = z.object({
  data: z.object({
    is_valid: z.boolean(),
    app_id: z.string().optional(),
    expires_at: z.number().optional(),
  }),
});

const WabaListSchema = z.object({
  data: z.array(z.object({ id: z.string(), name: z.string().optional() })),
});

const PhoneNumberSchema = z.object({
  id: z.string(),
  display_phone_number: z.string().optional(),
  verified_name: z.string().optional(),
});

const PhoneNumbersResponseSchema = z.object({
  data: z.array(PhoneNumberSchema),
});

const SubscribedAppsResponseSchema = z.object({
  success: z.boolean().optional(),
});

export interface DebugTokenResult {
  readonly isValid: boolean;
  readonly appId: string | undefined;
  readonly expiresAt: number | undefined;
}

export interface WhatsAppBusinessAccount {
  readonly wabaId: string;
  readonly name: string | undefined;
}

export interface WhatsAppPhoneNumber {
  readonly phoneNumberId: string;
  readonly displayPhoneNumber: string | undefined;
  readonly verifiedName: string | undefined;
}

export interface WaGraphClientOptions {
  readonly apiVersion: string;
  readonly timeoutMs?: number;
  /** Injectable `fetch` implementation — defaults to the global native `fetch`; overridable for tests. */
  readonly fetchImpl?: typeof fetch;
}

export class WaGraphClient {
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: WaGraphClientOptions) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async debugToken(params: {
    readonly inputToken: string;
    readonly appAccessToken: string;
  }): Promise<Result<DebugTokenResult, WaGraphError>> {
    const url = new URL(`${GRAPH_BASE_URL}/${this.options.apiVersion}/debug_token`);
    url.searchParams.set("input_token", params.inputToken);
    url.searchParams.set("access_token", params.appAccessToken);
    const responseResult = await this.doFetch(url);
    if (!responseResult.ok) {
      return responseResult;
    }
    const parsed = await this.parseBody(responseResult.value, DebugTokenResponseSchema);
    if (!parsed.ok) {
      return parsed;
    }
    return ok({
      isValid: parsed.value.data.is_valid,
      appId: parsed.value.data.app_id,
      expiresAt: parsed.value.data.expires_at,
    });
  }

  async getWhatsAppBusinessAccounts(params: {
    readonly accessToken: string;
  }): Promise<Result<readonly WhatsAppBusinessAccount[], WaGraphError>> {
    const url = new URL(
      `${GRAPH_BASE_URL}/${this.options.apiVersion}/me/whatsapp_business_accounts`,
    );
    url.searchParams.set("access_token", params.accessToken);
    const responseResult = await this.doFetch(url);
    if (!responseResult.ok) {
      return responseResult;
    }
    const parsed = await this.parseBody(responseResult.value, WabaListSchema);
    if (!parsed.ok) {
      return parsed;
    }
    return ok(parsed.value.data.map((row) => ({ wabaId: row.id, name: row.name })));
  }

  async getPhoneNumbers(params: {
    readonly wabaId: string;
    readonly accessToken: string;
  }): Promise<Result<readonly WhatsAppPhoneNumber[], WaGraphError>> {
    const url = new URL(
      `${GRAPH_BASE_URL}/${this.options.apiVersion}/${params.wabaId}/phone_numbers`,
    );
    url.searchParams.set("access_token", params.accessToken);
    const responseResult = await this.doFetch(url);
    if (!responseResult.ok) {
      return responseResult;
    }
    const parsed = await this.parseBody(responseResult.value, PhoneNumbersResponseSchema);
    if (!parsed.ok) {
      return parsed;
    }
    return ok(
      parsed.value.data.map((row) => ({
        phoneNumberId: row.id,
        displayPhoneNumber: row.display_phone_number,
        verifiedName: row.verified_name,
      })),
    );
  }

  async registerWebhookSubscription(params: {
    readonly wabaId: string;
    readonly accessToken: string;
  }): Promise<Result<true, WaGraphError>> {
    const url = new URL(
      `${GRAPH_BASE_URL}/${this.options.apiVersion}/${params.wabaId}/subscribed_apps`,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: "POST",
        headers: { authorization: `Bearer ${params.accessToken}` },
        signal: controller.signal,
      });
    } catch (cause) {
      clearTimeout(timeout);
      return err(
        new WaGraphError(`WhatsApp Graph API network failure: ${describeCause(cause)}`, { cause }),
      );
    }
    clearTimeout(timeout);
    if (!response.ok) {
      return err(await this.toWaGraphError(response));
    }
    const parsed = await this.parseBody(response, SubscribedAppsResponseSchema);
    if (!parsed.ok) {
      return parsed;
    }
    return ok(true);
  }

  private async doFetch(url: URL): Promise<Result<Response, WaGraphError>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url.toString(), {
        method: "GET",
        signal: controller.signal,
      });
      if (!response.ok) {
        return err(await this.toWaGraphError(response));
      }
      return ok(response);
    } catch (cause) {
      return err(
        new WaGraphError(`WhatsApp Graph API network failure: ${describeCause(cause)}`, { cause }),
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
  ): Promise<Result<T, WaGraphError>> {
    let json: unknown;
    try {
      json = await response.json();
    } catch (cause) {
      return err(
        new WaGraphError(
          `WhatsApp Graph API returned a non-JSON response body: ${describeCause(cause)}`,
          { cause },
        ),
      );
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return err(
        new WaGraphError("WhatsApp Graph API response failed schema validation", {
          context: { zodError: parsed.error },
        }),
      );
    }
    return ok(parsed.data);
  }

  private async toWaGraphError(response: Response): Promise<WaGraphError> {
    let message = `WhatsApp Graph API request failed with HTTP ${response.status}`;
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
    return new WaGraphError(message, { context: { httpStatus: response.status } }, code);
  }
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
