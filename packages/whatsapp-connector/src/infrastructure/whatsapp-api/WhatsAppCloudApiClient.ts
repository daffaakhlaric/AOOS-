import { err, ok, type Result } from "@aos/common";

import type {
  IWhatsAppClient,
  WaInteractiveMessageInput,
  WaTemplateMessageInput,
  WaTextMessageInput,
} from "../../contracts/IWhatsAppClient.js";
import {
  ApiServerError,
  AuthError,
  RateLimitError,
  TemplateError,
  WhatsAppApiError,
} from "../../domain/errors/index.js";
import { WaErrorResponseSchema, type WaSendMessageResponse } from "../../types/WhatsAppApiTypes.js";

import { ApiRequestBuilder } from "./ApiRequestBuilder.js";
import { ApiResponseMapper } from "./ApiResponseMapper.js";

const META_INVALID_TOKEN_CODE = 190;
const META_TEMPLATE_ERROR_CODE = 132000;
const DEFAULT_RETRY_AFTER_MS = 1000;
const DEFAULT_TIMEOUT_MS = 10_000;

export interface WhatsAppCloudApiClientOptions {
  readonly timeoutMs?: number;
  /** Injectable fetch implementation — defaults to the global native `fetch`; overridable for tests. */
  readonly fetchImpl?: typeof fetch;
}

/**
 * `fetch`-based (no axios) implementation of `IWhatsAppClient`. Never throws: every failure mode
 * — HTTP error status, a non-2xx Meta error payload, a network/timeout failure, or a response
 * body that fails Zod validation — is converted to a `Result.err(WhatsAppApiError)`.
 */
export class WhatsAppCloudApiClient implements IWhatsAppClient {
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: WhatsAppCloudApiClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async sendText(
    input: WaTextMessageInput,
  ): Promise<Result<WaSendMessageResponse, WhatsAppApiError>> {
    return this.send(input.phoneNumberId, input.accessToken, ApiRequestBuilder.textBody(input));
  }

  async sendTemplate(
    input: WaTemplateMessageInput,
  ): Promise<Result<WaSendMessageResponse, WhatsAppApiError>> {
    return this.send(input.phoneNumberId, input.accessToken, ApiRequestBuilder.templateBody(input));
  }

  async sendInteractive(
    input: WaInteractiveMessageInput,
  ): Promise<Result<WaSendMessageResponse, WhatsAppApiError>> {
    return this.send(
      input.phoneNumberId,
      input.accessToken,
      ApiRequestBuilder.interactiveBody(input),
    );
  }

  private async send(
    phoneNumberId: string,
    accessToken: string,
    body: unknown,
  ): Promise<Result<WaSendMessageResponse, WhatsAppApiError>> {
    const url = ApiRequestBuilder.messagesUrl(phoneNumberId);
    const responseResult = await this.doFetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!responseResult.ok) {
      return responseResult;
    }
    let json: unknown;
    try {
      json = await responseResult.value.json();
    } catch (cause) {
      return err(
        new ApiServerError(
          `WhatsApp Cloud API returned a non-JSON response body: ${describeCause(cause)}`,
          { cause },
        ),
      );
    }
    return ApiResponseMapper.toSendMessageResponse(json);
  }

  private async doFetch(
    url: string,
    init: RequestInit,
  ): Promise<Result<Response, WhatsAppApiError>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        return err(await this.toWhatsAppApiError(response));
      }
      return ok(response);
    } catch (cause) {
      return err(
        new ApiServerError(`WhatsApp Cloud API network failure: ${describeCause(cause)}`, {
          cause,
        }),
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async toWhatsAppApiError(response: Response): Promise<WhatsAppApiError> {
    const httpStatus = response.status;
    let metaErrorCode: number | undefined;
    let message = `WhatsApp Cloud API request failed with HTTP ${httpStatus}`;
    try {
      const body: unknown = await response.json();
      const parsed = WaErrorResponseSchema.safeParse(body);
      if (parsed.success) {
        metaErrorCode = parsed.data.error.code;
        message = parsed.data.error.message;
      }
    } catch {
      // Non-JSON error body — fall back to the generic HTTP-status-only message above.
    }

    if (metaErrorCode === META_INVALID_TOKEN_CODE) {
      return new AuthError(message);
    }
    if (metaErrorCode === META_TEMPLATE_ERROR_CODE) {
      return new TemplateError(message);
    }
    if (httpStatus === 429) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      return new RateLimitError(message, retryAfterMs);
    }
    if (httpStatus === 401) {
      return new AuthError(message);
    }
    if (httpStatus === 500 || httpStatus === 503) {
      return new ApiServerError(message, { context: { httpStatus } });
    }
    return new WhatsAppApiError(message, { httpStatus, metaErrorCode });
  }
}

function parseRetryAfterMs(headerValue: string | null): number {
  if (headerValue === null) {
    return DEFAULT_RETRY_AFTER_MS;
  }
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const asDate = Date.parse(headerValue);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now());
  }
  return DEFAULT_RETRY_AFTER_MS;
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
