import type { IResponseGenerator, ResponseContext } from "../contracts/IResponseGenerator.js";
import { MAX_MESSAGE_LENGTH, truncateToSentence } from "../responses/formatters.js";

import { buildConversationMessages } from "./buildJessyPrompt.js";
import type { ILlmChatClient } from "./OpenAiChatClient.js";

/** Narrow logging seam — matches the subset of `@aos/logger`'s pino-shaped `Logger.warn` this class actually calls, so tests can inject a plain spy instead of a real logger. */
export interface LlmFallbackLogger {
  warn(obj: Record<string, unknown>, msg?: string): void;
}

export interface LlmResponseGeneratorOptions {
  readonly client: ILlmChatClient;
  /**
   * The real, unmodified rule-based generator — invoked verbatim for this one message on ANY LLM
   * failure (coordinator note #3): missing/empty key, timeout, a malformed/empty/too-long
   * completion, or any other OpenAI error. A real lead must never go unreplied-to or receive
   * something malformed because of an LLM hiccup.
   */
  readonly fallback: IResponseGenerator;
  readonly logger?: LlmFallbackLogger;
}

/**
 * LLM-backed `IResponseGenerator` (spec "LLM for Jessy in packages/sales-agent"): builds Jessy's
 * system prompt + conversation history from `ResponseContext` (`buildJessyPrompt.ts`), calls
 * `ILlmChatClient` (`OpenAiChatClient` in production), enforces the exact same
 * `MAX_MESSAGE_LENGTH` invariant `ResponseGenerator` enforces (`responses/formatters.ts`), and
 * falls back to the real, rule-based `ResponseGenerator` on ANY failure — never lets a real lead
 * go unreplied-to or receive malformed output because OpenAI had a bad moment.
 */
export class LlmResponseGenerator implements IResponseGenerator {
  private readonly client: ILlmChatClient;
  private readonly fallback: IResponseGenerator;
  private readonly logger: LlmFallbackLogger | undefined;

  constructor(options: LlmResponseGeneratorOptions) {
    this.client = options.client;
    this.fallback = options.fallback;
    this.logger = options.logger;
  }

  async generate(context: ResponseContext): Promise<string> {
    try {
      const result = await this.client.complete({ messages: buildConversationMessages(context) });
      if (!result.ok) {
        return this.fallbackTo(context, result.error.message);
      }

      const text = result.value.trim();
      if (text.length === 0) {
        return this.fallbackTo(context, "OpenAI returned an empty completion");
      }

      return text.length <= MAX_MESSAGE_LENGTH ? text : truncateToSentence(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      return this.fallbackTo(context, `unexpected error building/calling the LLM: ${message}`);
    }
  }

  private fallbackTo(context: ResponseContext, reason: string): Promise<string> {
    this.logger?.warn(
      { reason },
      "LlmResponseGenerator: falling back to rule-based ResponseGenerator",
    );
    return this.fallback.generate(context);
  }
}
