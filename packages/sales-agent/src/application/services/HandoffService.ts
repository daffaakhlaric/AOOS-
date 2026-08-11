import type { AssignLead, AssignLeadOutcome, SalesTeamRegistry } from "@aos/branch-manager";
import { err, ok, type Result } from "@aos/common";
import type { InventoryUnit } from "@aos/dss-inventory-connector";
import type { OutgoingMessage } from "@aos/whatsapp-connector";

import { HandoffPackageBuilder } from "../../builders/HandoffPackageBuilder.js";
import type { HandoffPackage } from "../../domain/entities/HandoffPackage.js";
import type { LeadConversation } from "../../domain/entities/LeadConversation.js";
import { HandoffError } from "../../domain/errors/HandoffError.js";
import type { JessyAgentEvents } from "../../domain/events/JessyAgentEvents.js";
import { getHandoffResponse } from "../../responses/HandoffResponses.js";

import { prepareOutgoingMessage } from "./OutgoingMessagePreparer.js";

export interface HandoffInput {
  readonly conversation: LeadConversation;
  readonly matchedUnits: ReadonlyArray<InventoryUnit>;
  readonly tenantId: string;
  readonly correlationId: string;
}

export interface HandoffOutcome {
  readonly handoffPackage: HandoffPackage;
  readonly outgoingMessage: OutgoingMessage;
  readonly salesName: string;
}

const DEFAULT_SALES_NAME = "tim sales kita";

/**
 * Prepares + triggers a HOT-lead handoff (spec "application/services/HandoffService.ts"): builds
 * the `HandoffPackage`, calls `@aos/branch-manager`'s real `AssignLead` use case, resolves the
 * assigned sales human's display name, prepares (never sends — design resolution #5) the handoff
 * `OutgoingMessage` via `@aos/whatsapp-connector`'s real types, and publishes `HandoffTriggered`.
 */
export class HandoffService {
  constructor(
    private readonly assignLead: AssignLead,
    private readonly salesTeamRegistry: SalesTeamRegistry,
    private readonly events: JessyAgentEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async handoff(input: HandoffInput): Promise<Result<HandoffOutcome, HandoffError>> {
    const { conversation } = input;
    const handoffPackage = HandoffPackageBuilder.build(conversation, input.matchedUnits);

    const assignResult = await this.assignLead.execute({
      leadId: conversation.leadPhone,
      branchId: conversation.branchId,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
    });
    if (!assignResult.ok) {
      return err(new HandoffError(assignResult.error.message, { cause: assignResult.error }));
    }

    const salesName = this.resolveSalesName(assignResult.value);

    const messageResult = prepareOutgoingMessage(
      conversation.leadPhone,
      conversation.branchId,
      getHandoffResponse(salesName, conversation.inboundMessageCount),
    );
    if (!messageResult.ok) {
      return err(new HandoffError(messageResult.error.message, { cause: messageResult.error }));
    }

    await this.events.publishHandoffTriggered({
      conversationId: conversation.id.toString(),
      leadPhone: conversation.leadPhone,
      branchId: conversation.branchId,
      score: conversation.score.toNumber(),
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      occurredAt: this.now(),
      version: "1.0",
    });

    return ok({ handoffPackage, outgoingMessage: messageResult.value, salesName });
  }

  private resolveSalesName(outcome: AssignLeadOutcome): string {
    if (outcome.status !== "ASSIGNED") {
      return DEFAULT_SALES_NAME;
    }
    const salesHumanResult = this.salesTeamRegistry.getById(outcome.assignment.salesHumanId);
    return salesHumanResult.ok ? salesHumanResult.value.name : DEFAULT_SALES_NAME;
  }
}
