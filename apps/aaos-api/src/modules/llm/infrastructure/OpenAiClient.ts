import { err, ok, type Result } from "@aos/common";

/**
 * `api.openai.com`'s host and the one endpoint this app calls — kept as named constants (not
 * inline string literals) so both are easy to find/change in one place and easy to reference from
 * MSW test handlers, mirroring `packages/creative-connector/src/infrastructure/kie-api/
 * KieAiGenerationClient.ts`'s `KIE_GENERATION_BASE_URL`/`*_PATH` precedent.
 */
export const OPENAI_BASE_URL = "https://api.openai.com";
export const CHAT_COMPLETIONS_PATH = "/v1/chat/completions";

/** Cost-efficient default per the spec's "Cost Optimization" section — cheap enough for per-request analysis, still capable of following the `response_format: json_object` contract. */
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

const DEFAULT_TIMEOUT_MS = 30_000;

export interface OpenAiApiErrorOptions {
  readonly cause?: Error;
  readonly httpStatus?: number;
}

/**
 * A `api.openai.com` call failed — a non-2xx HTTP response, a network/timeout failure reaching
 * it, or a response body that isn't the shape this client expects. Always caught internally by
 * `LlmService` and turned into an `available: false` fallback DTO (spec Section 7) — this error
 * type never crosses the HTTP boundary / reaches `AaosExceptionFilter`.
 */
export class OpenAiApiError extends Error {
  public readonly httpStatus: number | undefined;

  constructor(message: string, options: OpenAiApiErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "OpenAiApiError";
    this.httpStatus = options.httpStatus;
  }
}

export type ChatRole = "system" | "user" | "assistant";

/**
 * Kai Creative Engine Sprint 1 (photo analysis) — OpenAI's real multi-part message content shape
 * for vision-capable models (`gpt-4o-mini` and later support `image_url` parts alongside `text`).
 * `image_url.url` is passed as the real, already-public Supabase Storage photo URL directly (no
 * base64 fetch-and-re-encode round trip needed — unlike the pasted spec's `urlToBase64`, OpenAI's
 * Chat Completions API accepts a plain HTTPS image URL).
 */
export type OpenAiContentPart =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "image_url"; readonly image_url: { readonly url: string } };

export interface OpenAiChatMessage {
  readonly role: ChatRole;
  readonly content: string | ReadonlyArray<OpenAiContentPart>;
}

export interface CreateChatCompletionOptions {
  readonly messages: ReadonlyArray<OpenAiChatMessage>;
  readonly model?: string;
  readonly temperature?: number;
  /** Requests OpenAI's `response_format: { type: "json_object" }` JSON mode (coordinator note #5) — reduces, but does not eliminate, malformed JSON output, so callers still parse defensively. */
  readonly jsonMode?: boolean;
}

export interface OpenAiClientOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  /** Injectable native `fetch` — overridable for tests (MSW normally suffices). */
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly model?: string;
}

/**
 * `fetch`-based (no `openai` npm SDK, per this repo's constitution) client for OpenAI's Chat
 * Completions API, mirroring `KieAiGenerationClient.ts`'s shape: native `fetch` only, a timeout via
 * `AbortController`, and `Result<T, OpenAiApiError>` instead of throwing for expected failure
 * modes (network failure, non-2xx status, malformed response body).
 */
export class OpenAiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly model: string;

  constructor(options: OpenAiClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? OPENAI_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.model = options.model ?? DEFAULT_OPENAI_MODEL;
  }

  async createChatCompletion(
    options: CreateChatCompletionOptions,
  ): Promise<Result<string, OpenAiApiError>> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${CHAT_COMPLETIONS_PATH}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model ?? this.model,
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      });
    } catch (error) {
      return err(
        new OpenAiApiError(`OpenAiClient: network failure calling POST ${CHAT_COMPLETIONS_PATH}`, {
          cause: error instanceof Error ? error : undefined,
        }),
      );
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (!response.ok) {
      return err(
        new OpenAiApiError(
          `OpenAiClient: ${CHAT_COMPLETIONS_PATH} responded with HTTP ${response.status}`,
          { httpStatus: response.status },
        ),
      );
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (error) {
      return err(
        new OpenAiApiError(
          `OpenAiClient: ${CHAT_COMPLETIONS_PATH} response body was not valid JSON`,
          {
            cause: error instanceof Error ? error : undefined,
          },
        ),
      );
    }

    const content = extractMessageContent(json);
    if (content === undefined) {
      return err(
        new OpenAiApiError(
          `OpenAiClient: ${CHAT_COMPLETIONS_PATH} response was missing choices[0].message.content`,
        ),
      );
    }
    return ok(content);
  }
}

/** Defensively reads `json.choices[0].message.content` without trusting OpenAI's response shape (RULE-064 — external API output is untrusted input). */
function extractMessageContent(json: unknown): string | undefined {
  if (typeof json !== "object" || json === null) {
    return undefined;
  }
  const choices = (json as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return undefined;
  }
  const first = choices[0] as unknown;
  if (typeof first !== "object" || first === null) {
    return undefined;
  }
  const message = (first as Record<string, unknown>).message;
  if (typeof message !== "object" || message === null) {
    return undefined;
  }
  const content = (message as Record<string, unknown>).content;
  return typeof content === "string" ? content : undefined;
}
