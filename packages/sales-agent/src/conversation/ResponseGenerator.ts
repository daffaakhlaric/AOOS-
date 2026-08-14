import type { IResponseGenerator, ResponseContext } from "../contracts/IResponseGenerator.js";
import { ConversationStage } from "../domain/value-objects/ConversationStage.js";
import { getClosingResponse } from "../responses/ClosingResponses.js";
import { getColdNurtureResponse } from "../responses/ColdResponses.js";
import { getDiscoveryQuestion, getBudgetFollowUp } from "../responses/DiscoveryResponses.js";
import { getGreeting } from "../responses/GreetingResponses.js";
import { getHandoffResponse } from "../responses/HandoffResponses.js";
import { getObjectionResponse } from "../responses/ObjectionResponses.js";
import { pickFromPool } from "../responses/PoolSelector.js";
import { getDpInfoResponse } from "../responses/PriceResponses.js";
import { nextCriterionToAsk, QualificationResponses } from "../responses/QualificationResponses.js";
import {
  SYARIAH_DP_RESPONSE_POOL,
  SYARIAH_RESPONSE_POOL,
  SYARIAH_TRUST_RESPONSE_POOL,
} from "../responses/SyariahResponses.js";
import { getUnitFoundResponse, getUnitNotFoundResponse } from "../responses/UnitResponses.js";

import { DetectedIntent } from "./IntentDetector.js";

const CLOSED_POOL: ReadonlyArray<string> = [
  "Terima kasih ya kak udah ngobrol sama Jessy 🙏 Kalau butuh bantuan lagi, tinggal chat aja!",
];

const DEFAULT_SALES_NAME = "tim sales kita";

/** Matches `SalesAgentConfig`'s own schema default (spec `hotThreshold: z.number()...default(65)`) — used only when a caller builds a `ResponseContext` without `hotThreshold` (AAOS-W3D Fix 1). */
const DEFAULT_HOT_THRESHOLD = 65;

/**
 * Soft/hard response-length backstop (AAOS-W3D Fix 2). The primary fix is shortening the actual
 * pool content (`ClosingResponses`/`QualificationResponses`/trimmed `UnitResponses`/`PriceResponses`
 * templates) so this should never actually trigger in practice — it exists purely as a defensive net
 * so a future pool edit that quietly grows past the hard ceiling can't silently regress
 * `ResponseLengthScorer`'s `MAX_OVER_300`/`MAX_OVER_400` rules.
 */
const SOFT_LENGTH_TARGET = 150;
const HARD_LENGTH_CEILING = 200;

/**
 * Stages where a detected SYARIAH intent overrides the stage's normal reply (AAOS-W3A-S1 Fix 1).
 * Deliberately excludes CLOSING/HANDOFF/NURTURE/CLOSED — those are terminal, script-critical
 * replies (test-drive CTA, handoff message naming the sales rep, cold nurture, thank-you) that must
 * never be silently swapped out just because the lead once said "syariah"/"halal" earlier in the
 * conversation.
 */
const SYARIAH_ELIGIBLE_STAGES: ReadonlySet<ConversationStage> = new Set([
  ConversationStage.GREETING,
  ConversationStage.DISCOVERY,
  ConversationStage.QUALIFICATION,
  ConversationStage.UNIT_INFO,
  ConversationStage.PRICE_INFO,
  ConversationStage.OBJECTION,
]);

/**
 * Generates Jessy's reply text for the current stage/context (spec "responses/ResponseGenerator.ts"
 * — the concrete `IResponseGenerator`). Delegates to the per-stage response pools in `responses/`,
 * always via the deterministic `pickFromPool` seed derived from `conversation.inboundMessageCount`
 * (design resolution #4) — never `Math.random()`.
 */
export class ResponseGenerator implements IResponseGenerator {
  generate(context: ResponseContext): Promise<string> {
    return Promise.resolve(this.validateLength(this.rawResponse(context)));
  }

  private rawResponse(context: ResponseContext): string {
    const seed = context.conversation.inboundMessageCount;

    if (
      context.intents.includes(DetectedIntent.SYARIAH) &&
      SYARIAH_ELIGIBLE_STAGES.has(context.stage)
    ) {
      return this.syariahResponse(context, seed);
    }

    switch (context.stage) {
      case ConversationStage.GREETING:
        return getGreeting(seed);

      case ConversationStage.DISCOVERY:
        return getDiscoveryQuestion(seed);

      case ConversationStage.QUALIFICATION:
        return this.qualificationResponse(context, seed);

      case ConversationStage.UNIT_INFO:
        return this.unitInfoResponse(context, seed);

      case ConversationStage.PRICE_INFO:
        return this.priceInfoResponse(context, seed);

      case ConversationStage.OBJECTION:
        return getObjectionResponse(context.messageText, seed, context.intents);

      case ConversationStage.CLOSING:
        return getClosingResponse(
          context.conversation.score.toNumber(),
          context.conversation.closingAttemptCount,
          context.hotThreshold ?? DEFAULT_HOT_THRESHOLD,
          seed,
        );

      case ConversationStage.HANDOFF:
        return getHandoffResponse(context.salesName ?? DEFAULT_SALES_NAME, seed);

      case ConversationStage.NURTURE:
        return getColdNurtureResponse(seed);

      case ConversationStage.CLOSED:
        return pickFromPool(CLOSED_POOL, seed);
    }
  }

  /** AAOS-W3D Fix 3: asks for the next missing-and-not-yet-asked core criterion (`QualificationResponses.nextCriterionToAsk`); once all 4 are either extracted or already asked, falls back to the original generic budget-follow-up pool so passive/volunteered-info conversations (e.g. `ReadyBuyer`'s script) behave exactly as before. */
  private qualificationResponse(context: ResponseContext, seed: number): string {
    const criterion = nextCriterionToAsk(context.conversation);
    if (criterion !== undefined) {
      return QualificationResponses.askFor(criterion, seed);
    }
    return getBudgetFollowUp(seed);
  }

  /**
   * AAOS-W3D Fix 2 backstop: pool content is the primary fix (every pool entry is already ≤ 150
   * chars — see each `responses/*.ts` file), so this only ever engages if a future template
   * (interpolated with real unit/price data) unexpectedly grows past the hard ceiling.
   */
  private validateLength(response: string): string {
    if (response.length <= HARD_LENGTH_CEILING) {
      return response;
    }
    return this.trimToSentence(response, SOFT_LENGTH_TARGET);
  }

  /** Trims at the nearest sentence/line boundary at-or-before `maxLength`, falling back to a hard character cut if the text has no such boundary early enough. */
  private trimToSentence(text: string, maxLength: number): string {
    const truncated = text.slice(0, maxLength);
    const lastBoundary = Math.max(
      truncated.lastIndexOf("."),
      truncated.lastIndexOf("!"),
      truncated.lastIndexOf("?"),
      truncated.lastIndexOf("\n"),
    );
    return lastBoundary > 0 ? text.slice(0, lastBoundary + 1) : truncated;
  }

  /** SYARIAH-intent override (AAOS-W3A-S1 Fix 1): DP-flavored if also ASK_PRICE, trust-flavored if also HESITATION, otherwise the general syariah pool — checked in that priority order, mirroring `ObjectionResponses`' known-then-specific-then-generic shape. */
  private syariahResponse(context: ResponseContext, seed: number): string {
    if (context.intents.includes(DetectedIntent.ASK_PRICE)) {
      return pickFromPool(SYARIAH_DP_RESPONSE_POOL, seed);
    }
    if (context.intents.includes(DetectedIntent.HESITATION)) {
      return pickFromPool(SYARIAH_TRUST_RESPONSE_POOL, seed);
    }
    return pickFromPool(SYARIAH_RESPONSE_POOL, seed);
  }

  private unitInfoResponse(context: ResponseContext, seed: number): string {
    const firstMatch = context.matchedUnits[0];
    if (firstMatch !== undefined) {
      return getUnitFoundResponse(firstMatch, seed);
    }
    return getUnitNotFoundResponse(
      context.requestedModel ?? "unit itu",
      context.branchName,
      context.alternativeBranchName,
    );
  }

  private priceInfoResponse(context: ResponseContext, seed: number): string {
    const firstMatch = context.matchedUnits[0];
    if (firstMatch !== undefined) {
      return getDpInfoResponse(firstMatch, seed);
    }
    return "Unit yang mana nih kak yang mau dihitung DP/cicilannya? Biar Jessy bantu hitungin 😊";
  }
}
