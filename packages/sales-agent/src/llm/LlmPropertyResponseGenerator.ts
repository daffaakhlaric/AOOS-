import type {
  IPropertyResponseGenerator,
  PropertyResponseContext,
} from "../contracts/IPropertyResponseGenerator.js";
import {
  HARD_LENGTH_CEILING,
  SOFT_LENGTH_TARGET,
} from "../conversation/PropertyResponseGenerator.js";
import { truncateToSentence } from "../responses/formatters.js";

import { buildPropertyConversationMessages } from "./buildClaraPropertyPrompt.js";
import type { LlmFallbackLogger } from "./LlmResponseGenerator.js";
import type { ILlmChatClient } from "./OpenAiChatClient.js";

export interface LlmPropertyResponseGeneratorOptions {
  readonly client: ILlmChatClient;
  /**
   * The real, unmodified rule-based `PropertyResponseGenerator` — invoked verbatim for this one
   * message on ANY LLM failure, same discipline as `LlmResponseGenerator`'s own `fallback`
   * (missing/empty key, timeout, a malformed/empty/too-long completion, or any other OpenAI
   * error). A real PROPERTY lead must never go unreplied-to or receive something malformed
   * because of an LLM hiccup.
   */
  readonly fallback: IPropertyResponseGenerator;
  readonly logger?: LlmFallbackLogger;
  /**
   * AAOS Self-Learning AI — PROPERTY LLM wiring: resolved ONCE at composition time
   * (`ClaraAgentFactory.createPropertyConversationEngine`/`createPropertyAgent`), threaded
   * straight through to every `generate()` call — same "once per composed agent" granularity
   * `LlmResponseGenerator.promptOverride`'s own doc establishes for AUTOMOTIVE, for the identical
   * reason: every real caller composes one PROPERTY agent per session/conversation and reuses it
   * for every turn, so there is no live "override changed mid-conversation" signal to react to.
   */
  readonly promptOverride?: string;
}

/**
 * LLM-backed `IPropertyResponseGenerator` — the PROPERTY-vertical sibling to
 * `LlmResponseGenerator`, same exact shape: builds Clara's PROPERTY system prompt + conversation
 * history from `PropertyResponseContext` (`buildClaraPropertyPrompt.ts`), calls `ILlmChatClient`
 * (`OpenAiChatClient` in production), enforces PROPERTY's own real `HARD_LENGTH_CEILING`/
 * `SOFT_LENGTH_TARGET` invariants (reused from `PropertyResponseGenerator.ts`, not reinvented),
 * and falls back to the real, rule-based `PropertyResponseGenerator` on ANY failure.
 */
export class LlmPropertyResponseGenerator implements IPropertyResponseGenerator {
  private readonly client: ILlmChatClient;
  private readonly fallback: IPropertyResponseGenerator;
  private readonly logger: LlmFallbackLogger | undefined;
  private readonly promptOverride: string | undefined;

  constructor(options: LlmPropertyResponseGeneratorOptions) {
    this.client = options.client;
    this.fallback = options.fallback;
    this.logger = options.logger;
    this.promptOverride = options.promptOverride;
  }

  async generate(context: PropertyResponseContext): Promise<string> {
    try {
      const result = await this.client.complete({
        messages: buildPropertyConversationMessages(context, this.promptOverride),
      });
      if (!result.ok) {
        return this.fallbackTo(context, result.error.message);
      }

      const text = result.value.trim();
      if (text.length === 0) {
        return this.fallbackTo(context, "OpenAI returned an empty completion");
      }

      return text.length <= HARD_LENGTH_CEILING
        ? text
        : truncateToSentence(text, SOFT_LENGTH_TARGET);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      return this.fallbackTo(context, `unexpected error building/calling the LLM: ${message}`);
    }
  }

  private fallbackTo(context: PropertyResponseContext, reason: string): Promise<string> {
    this.logger?.warn(
      { reason },
      "LlmPropertyResponseGenerator: falling back to rule-based PropertyResponseGenerator",
    );
    return this.fallback.generate(context);
  }
}
