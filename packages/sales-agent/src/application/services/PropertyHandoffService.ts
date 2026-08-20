import type { AssignLead, AssignLeadOutcome, SalesTeamRegistry } from "@aos/branch-manager";
import { err, ok, type Result } from "@aos/common";
import type { OutgoingMessage } from "@aos/whatsapp-connector";

import { PropertyHandoffPackageBuilder } from "../../builders/PropertyHandoffPackageBuilder.js";
import type { LeadConversation } from "../../domain/entities/LeadConversation.js";
import type { PropertyHandoffPackage } from "../../domain/entities/PropertyHandoffPackage.js";
import type { PropertyListing } from "../../domain/entities/PropertyListing.js";
import { HandoffError } from "../../domain/errors/HandoffError.js";
import type { JessyAgentEvents } from "../../domain/events/JessyAgentEvents.js";
import { getPropertyHandoffResponse } from "../../responses/PropertyResponses.js";

import { prepareOutgoingMessage } from "./OutgoingMessagePreparer.js";

export interface PropertyHandoffInput {
  readonly conversation: LeadConversation;
  readonly matchedListings: ReadonlyArray<PropertyListing>;
  readonly tenantId: string;
  readonly correlationId: string;
}

export interface PropertyHandoffOutcome {
  readonly handoffPackage: PropertyHandoffPackage;
  readonly outgoingMessage: OutgoingMessage;
  readonly salesName: string;
}

const DEFAULT_SALES_NAME = "tim sales kita";

/**
 * PROPERTY-vertical sibling to `HandoffService` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8,
 * spec section 12 point 2): prepares + triggers a HOT PROPERTY-lead handoff. Confirmed via direct
 * read that `HandoffService`/`HandoffPackageBuilder`/`HandoffPackage` are concretely
 * `InventoryUnit`-typed end to end — this is a real, additive sibling (not a retrofit), reusing
 * `@aos/branch-manager`'s real `AssignLead`/`SalesTeamRegistry` and `JessyAgentEvents
 * .publishHandoffTriggered` exactly as-is (that event payload has no `InventoryUnit`/`ScoreDelta`
 * coupling, confirmed generic).
 */
export class PropertyHandoffService {
  constructor(
    private readonly assignLead: AssignLead,
    private readonly salesTeamRegistry: SalesTeamRegistry,
    private readonly events: JessyAgentEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async handoff(
    input: PropertyHandoffInput,
  ): Promise<Result<PropertyHandoffOutcome, HandoffError>> {
    const { conversation } = input;
    const handoffPackage = PropertyHandoffPackageBuilder.build(conversation, input.matchedListings);

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
      getPropertyHandoffResponse(salesName, conversation.inboundMessageCount),
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
