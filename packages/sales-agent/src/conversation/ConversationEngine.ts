import { ok, type Result } from "@aos/common";
import type { InventoryUnit } from "@aos/dss-inventory-connector";

import type { EngineDecision, IConversationEngine } from "../contracts/IConversationEngine.js";
import type { IResponseGenerator } from "../contracts/IResponseGenerator.js";
import type { LeadConversation } from "../domain/entities/LeadConversation.js";
import type { AgentError } from "../domain/errors/AgentError.js";
import { fromBranch } from "../domain/value-objects/BranchId.js";
import { ConversationStage } from "../domain/value-objects/ConversationStage.js";
import type { InventoryQuerier } from "../intelligence/InventoryQuerier.js";
import { JessyKnowledgeBase } from "../intelligence/JessyKnowledgeBase.js";

import { IntentDetector } from "./IntentDetector.js";
import { StageDetector, type StageDetectorThresholds } from "./StageDetector.js";

const MODEL_NAMES = ["Xpander", "Brio", "Avanza", "Raize", "Rush", "Stargazer"];
const MODEL_PATTERN = new RegExp(`\\b(${MODEL_NAMES.join("|")})\\b`, "i");
const BUDGET_AMOUNT_PATTERN = /(\d+(?:[.,]\d+)?)\s*(juta|jt)/i;

function extractModel(messageText: string): string | undefined {
  const match = MODEL_PATTERN.exec(messageText);
  if (match === null) {
    return undefined;
  }
  const canonical = MODEL_NAMES.find((name) => name.toLowerCase() === match[1]!.toLowerCase());
  return canonical;
}

function extractMaxPriceIDR(messageText: string): number | undefined {
  const match = BUDGET_AMOUNT_PATTERN.exec(messageText);
  if (match === null) {
    return undefined;
  }
  const amount = Number.parseFloat(match[1]!.replace(",", "."));
  /* v8 ignore start -- unreachable: `BUDGET_AMOUNT_PATTERN`'s capture group only ever matches
     digits with an optional single `.`/`,` separator, so `parseFloat` always succeeds here. */
  if (!Number.isFinite(amount)) {
    return undefined;
  }
  /* v8 ignore stop */
  return Math.round(amount * 1_000_000);
}

const UNIT_QUESTION_STAGES: ReadonlySet<ConversationStage> = new Set([
  ConversationStage.UNIT_INFO,
  ConversationStage.PRICE_INFO,
]);

/**
 * Decides what Jessy says next (spec "conversation/ConversationEngine.ts"): runs
 * `IntentDetector` + `StageDetector`, queries real inventory via `InventoryQuerier` when the
 * stage is `UNIT_INFO`/`PRICE_INFO`, then delegates to `IResponseGenerator` for the final text.
 */
export class ConversationEngine implements IConversationEngine {
  constructor(
    private readonly inventoryQuerier: InventoryQuerier,
    private readonly thresholds: StageDetectorThresholds,
    private readonly responseGenerator: IResponseGenerator,
    private readonly resolveSalesName: (branchId: LeadConversation["branchId"]) => string,
  ) {}

  async decide(
    conversation: LeadConversation,
    messageText: string,
  ): Promise<Result<EngineDecision, AgentError>> {
    const intents = IntentDetector.detect(messageText);
    const stage = StageDetector.detect(conversation, intents, this.thresholds);
    const branchName = JessyKnowledgeBase.branch(conversation.branchId).name;

    let matchedUnits: InventoryUnit[] = [];
    let requestedModel: string | undefined;
    let alternativeBranchName: string | undefined;

    if (UNIT_QUESTION_STAGES.has(stage)) {
      requestedModel = extractModel(messageText);
      const maxPrice = extractMaxPriceIDR(messageText);
      const result = await this.inventoryQuerier.findForLead({
        branch: conversation.branchId,
        model: requestedModel,
        maxPrice,
      });
      if (!result.ok) {
        return result;
      }
      matchedUnits = result.value;

      if (matchedUnits.length === 0 && requestedModel !== undefined) {
        const alternative = this.inventoryQuerier.findAlternative({
          model: requestedModel,
          maxPrice,
        });
        const alternativeUnit = alternative[0];
        if (alternativeUnit !== undefined) {
          const alternativeBranchId = fromBranch(alternativeUnit.branch);
          alternativeBranchName =
            alternativeBranchId === undefined
              ? undefined
              : JessyKnowledgeBase.branch(alternativeBranchId).name;
        }
      }
    }

    const responseText = this.responseGenerator.generate({
      conversation,
      stage,
      intents,
      messageText,
      matchedUnits,
      requestedModel,
      alternativeBranchName,
      branchName,
      salesName: this.resolveSalesName(conversation.branchId),
      hotThreshold: this.thresholds.hotThreshold,
    });

    return ok({ nextStage: stage, responseText, matchedUnits });
  }
}
