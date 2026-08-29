import type { InventoryUnit } from "@aos/dss-inventory-connector";

import type { DetectedIntent } from "../conversation/IntentDetector.js";
import type { LeadConversation } from "../domain/entities/LeadConversation.js";
import type { ConversationStage } from "../domain/value-objects/ConversationStage.js";

export interface ResponseContext {
  readonly conversation: LeadConversation;
  readonly stage: ConversationStage;
  readonly intents: ReadonlyArray<DetectedIntent>;
  readonly messageText: string;
  readonly matchedUnits: ReadonlyArray<InventoryUnit>;
  /** The model name the lead asked about, if `UNIT_INFO`/`PRICE_INFO` and no match was found — used to phrase the "stok kosong" response. */
  readonly requestedModel?: string;
  /** A different branch's display name that DOES have a match, if the lead's own branch came up empty. */
  readonly alternativeBranchName?: string;
  readonly branchName: string;
  readonly salesName?: string;
  /**
   * The configured HOT threshold (AAOS-W3D Fix 1) — lets the CLOSING-stage branch pick
   * `CLOSING_HOT_POOL` vs the WARM/FOLLOW pools without `ResponseGenerator` needing its own copy of
   * `StageDetectorThresholds`. Optional (defaults to `SalesAgentConfig`'s own default of 65 — see
   * `ResponseGenerator`'s `DEFAULT_HOT_THRESHOLD`) purely so every pre-existing test call site that
   * builds a `ResponseContext` by hand keeps compiling unchanged; `ConversationEngine` always sets
   * it explicitly from the real configured thresholds.
   */
  readonly hotThreshold?: number;
}

/**
 * Port: generates Clara's natural-Indonesian reply text for a given stage/intent/context —
 * always ≤ 300 chars. Async because an implementation may call out to an LLM provider
 * (`LlmResponseGenerator`); the rule-based `ResponseGenerator` remains synchronous internally and
 * simply resolves immediately. NOT guaranteed deterministic across all implementations — the
 * rule-based `ResponseGenerator` is deterministic (same seed → same output), but `LlmResponseGenerator`
 * is not, by construction.
 */
export interface IResponseGenerator {
  generate(context: ResponseContext): Promise<string>;
}
