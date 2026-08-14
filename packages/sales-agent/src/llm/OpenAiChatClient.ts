import { err, ErrorCode, ok, type Result } from "@aos/common";

import { LlmError } from "../domain/errors/LlmError.js";

export interface OpenAiChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface ChatCompletionRequest {
  readonly messages: ReadonlyArray<OpenAiChatMessage>;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

/** Port: a minimal OpenAI-shaped chat-completions client — `OpenAiChatClient` is its one real, production implementation. Kept as a narrow interface (Interface Segregation) so `LlmResponseGenerator` never depends on more than "give me a completion for these messages". */
export interface ILlmChatClient {
  complete(request: ChatCompletionRequest): Promise<Result<string, LlmError>>;
}

export interface OpenAiChatClientOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  /** Injectable native `fetch` — overridable for tests (MSW normally suffices). */
  readonly fetchImpl?: typeof fetch;
}

export const OPENAI_BASE_URL = "https://api.openai.com";
export const CHAT_COMPLETIONS_PATH = "/v1/chat/completions";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_TOKENS = 200;
const DEFAULT_TEMPERATURE = 0.7;

/**
 * `fetch`-based (no `openai` npm SDK) OpenAI chat-completions client — mirrors
 * `@aos/creative-connector`'s `KieAiGenerationClient` conventions: injectable `fetchImpl`, an
 * explicit request timeout via `AbortController`, and every failure mode (missing key, network
 * failure, timeout, non-2xx response, malformed body) converted to `Result.err(LlmError)`, never
 * thrown.
 */
export class OpenAiChatClient implements ILlmChatClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAiChatClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? OPENAI_BASE_URL;
    this.model = options.model ?? DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: ChatCompletionRequest): Promise<Result<string, LlmError>> {
    if (this.apiKey.trim().length === 0) {
      return err(new LlmError(ErrorCode.VALIDATION_ERROR, "OpenAiChatClient: apiKey is empty"));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${CHAT_COMPLETIONS_PATH}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages,
          max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
          temperature: request.temperature ?? DEFAULT_TEMPERATURE,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      return err(
        new LlmError(
          isAbort ? ErrorCode.TIMEOUT : ErrorCode.UNAVAILABLE,
          `OpenAiChatClient: ${isAbort ? "request timed out" : "network failure"} calling ${CHAT_COMPLETIONS_PATH}`,
          { cause: error instanceof Error ? error : undefined },
        ),
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) {
      return err(
        new LlmError(
          ErrorCode.RATE_LIMITED,
          `OpenAiChatClient: ${CHAT_COMPLETIONS_PATH} responded with HTTP 429`,
        ),
      );
    }

    if (!response.ok) {
      return err(
        new LlmError(
          ErrorCode.UNAVAILABLE,
          `OpenAiChatClient: ${CHAT_COMPLETIONS_PATH} responded with HTTP ${response.status}`,
        ),
      );
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (error) {
      return err(
        new LlmError(ErrorCode.UNAVAILABLE, "OpenAiChatClient: response body was not valid JSON", {
          cause: error instanceof Error ? error : undefined,
        }),
      );
    }

    return mapCompletionResponse(json);
  }
}

interface RawChatCompletionResponse {
  readonly choices?: ReadonlyArray<{ readonly message?: { readonly content?: unknown } }>;
}

function mapCompletionResponse(json: unknown): Result<string, LlmError> {
  if (typeof json !== "object" || json === null) {
    return err(
      new LlmError(ErrorCode.UNAVAILABLE, "OpenAiChatClient: malformed response (not an object)"),
    );
  }
  const { choices } = json as RawChatCompletionResponse;
  if (!Array.isArray(choices) || choices.length === 0) {
    return err(
      new LlmError(ErrorCode.UNAVAILABLE, "OpenAiChatClient: malformed response (no choices)"),
    );
  }
  const content = choices[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    return err(
      new LlmError(ErrorCode.UNAVAILABLE, "OpenAiChatClient: malformed response (empty content)"),
    );
  }
  return ok(content.trim());
}
