import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { CapiConnectorConfig } from "../../config/CapiConnectorConfig.js";
import type { ICapiClient, SendEventsResult } from "../../contracts/ICapiClient.js";
import type { CapiBatch } from "../../domain/entities/CapiBatch.js";
import type { EmqReport } from "../../domain/entities/EmqReport.js";
import { CapiApiError } from "../../domain/errors/CapiApiError.js";

import { CapiRequestBuilder } from "./CapiRequestBuilder.js";
import {
  CapiResponseMapper,
  EmqDiagnosticsResponseSchema,
  SendEventsResponseSchema,
} from "./CapiResponseMapper.js";

const DEFAULT_TIMEOUT_MS = 30_000;

export interface MetaCapiClientOptions {
  readonly timeoutMs?: number;
  /** Injectable fetch implementation — defaults to the global native `fetch`; overridable for tests (MSW normally suffices, but this keeps the door open for a raw fetch mock too). */
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
}

/**
 * `fetch`-based (no axios/got) implementation of `ICapiClient`. Never throws: every failure
 * mode — HTTP error status, a network/timeout failure, or a response body that fails Zod
 * validation — is converted to a `Result.err(CapiApiError)`.
 */
export class MetaCapiClient implements ICapiClient {
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(options: MetaCapiClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  async sendEvents(
    batch: CapiBatch,
    config: CapiConnectorConfig,
  ): Promise<Result<SendEventsResult, CapiApiError>> {
    const url = CapiRequestBuilder.eventsUrl(config);
    const body = CapiRequestBuilder.eventsBody(batch, config);
    const responseResult = await this.doFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
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
        new CapiApiError(`Meta CAPI returned a non-JSON response body: ${describeCause(cause)}`, {
          cause,
        }),
      );
    }
    const parsed = SendEventsResponseSchema.safeParse(json);
    if (!parsed.success) {
      return err(
        new CapiApiError("Meta CAPI response failed schema validation", {
          cause: new ValidationError("Meta CAPI response failed schema validation", {
            context: { zodError: parsed.error },
          }),
        }),
      );
    }
    return ok(CapiResponseMapper.toSendEventsResult(parsed.data));
  }

  async getEmqScore(config: CapiConnectorConfig): Promise<Result<EmqReport, CapiApiError>> {
    const url = CapiRequestBuilder.emqUrl(config);
    const responseResult = await this.doFetch(url, { method: "GET" });
    if (!responseResult.ok) {
      return responseResult;
    }
    let json: unknown;
    try {
      json = await responseResult.value.json();
    } catch (cause) {
      return err(
        new CapiApiError(`Meta CAPI returned a non-JSON response body: ${describeCause(cause)}`, {
          cause,
        }),
      );
    }
    const parsed = EmqDiagnosticsResponseSchema.safeParse(json);
    if (!parsed.success) {
      return err(
        new CapiApiError("Meta CAPI diagnostics response failed schema validation", {
          cause: new ValidationError("Meta CAPI diagnostics response failed schema validation", {
            context: { zodError: parsed.error },
          }),
        }),
      );
    }
    return ok(CapiResponseMapper.toEmqReport(config.pixelId, parsed.data, this.now()));
  }

  private async doFetch(url: string, init: RequestInit): Promise<Result<Response, CapiApiError>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        return err(await CapiResponseMapper.toCapiApiError(response));
      }
      return ok(response);
    } catch (cause) {
      return err(new CapiApiError(`Meta CAPI network failure: ${describeCause(cause)}`, { cause }));
    } finally {
      clearTimeout(timeout);
    }
  }
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
