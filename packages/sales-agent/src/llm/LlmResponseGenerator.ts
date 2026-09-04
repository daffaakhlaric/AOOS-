import type { IResponseGenerator, ResponseContext } from "../contracts/IResponseGenerator.js";
import { MAX_MESSAGE_LENGTH, truncateToSentence } from "../responses/formatters.js";

import { buildConversationMessages } from "./buildClaraPrompt.js";
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
  /**
   * AAOS Self-Learning AI, Phase C wiring — the real, first caller of `buildSystemPrompt`'s
   * pre-existing `promptOverride` parameter (added in Phase A, unused until now — see
   * `buildClaraPrompt.ts`'s own doc). Resolved ONCE, at composition time
   * (`ClaraAgentFactory.create`/`ClaraSimulationComposer.compose`), not re-fetched per message:
   * this generator instance is composed fresh per conversation session in every real caller today
   * (`ClaraSimulationComposer.compose()` is called once per simulation session —
   * `SimulationRunnerService.runTurnLoop` then calls `processIncomingMessage.execute` once per
   * turn against the SAME composed agent), so "once per composed agent" is the real, honest
   * granularity this codebase supports — there is no live "override changed mid-conversation"
   * signal anywhere to react to, and building one would be unverifiable speculation. Threaded
   * straight through to every `generate()` call unchanged. `undefined` (the default) reproduces
   * today's exact unchanged behavior — the spec's own `SYSTEM_PROMPT_TEMPLATE`.
   */
  readonly promptOverride?: string;
}

/**
 * LLM-backed `IResponseGenerator` (spec "LLM for Clara in packages/sales-agent"): builds Clara's
 * system prompt + conversation history from `ResponseContext` (`buildClaraPrompt.ts`), calls
 * `ILlmChatClient` (`OpenAiChatClient` in production), enforces the exact same
 * `MAX_MESSAGE_LENGTH` invariant `ResponseGenerator` enforces (`responses/formatters.ts`), and
 * falls back to the real, rule-based `ResponseGenerator` on ANY failure — never lets a real lead
 * go unreplied-to or receive malformed output because OpenAI had a bad moment.
 */
export class LlmResponseGenerator implements IResponseGenerator {
  private readonly client: ILlmChatClient;
  private readonly fallback: IResponseGenerator;
  private readonly logger: LlmFallbackLogger | undefined;
  private readonly promptOverride: string | undefined;

  constructor(options: LlmResponseGeneratorOptions) {
    this.client = options.client;
    this.fallback = options.fallback;
    this.logger = options.logger;
    this.promptOverride = options.promptOverride;
  }

  async generate(context: ResponseContext): Promise<string> {
    try {
      const result = await this.client.complete({
        messages: buildConversationMessages(context, this.promptOverride),
      });
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
