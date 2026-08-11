import type { BranchId } from "@aos/branch-manager";
import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { PhoneNumberId } from "@aos/whatsapp-connector";

import type { ConversationId } from "../value-objects/ConversationId.js";
import type { LeadId } from "../value-objects/LeadId.js";

export type ConversationStatus = "ACTIVE" | "CLOSED";

/** The 4 exchange-count milestones this package tracks (spec schema `conversations.d1_count` .. `d5_count`) — see `SaveMessage`'s docstring for the exact pairing algorithm (design resolution #1). */
export interface ExchangeMilestones {
  readonly d1: 0 | 1;
  readonly d2: 0 | 1;
  readonly d3: 0 | 1;
  readonly d5: 0 | 1;
}

export interface ConversationProps {
  readonly id: ConversationId;
  readonly leadId: LeadId;
  readonly branchId: BranchId;
  readonly wabaPhoneNumberId: PhoneNumberId;
  readonly messageCount: number;
  readonly incomingCount: number;
  readonly outgoingCount: number;
  readonly milestones: ExchangeMilestones;
  readonly currentStage: string;
  readonly lastIntent?: string;
  readonly startedAt: Date;
  readonly lastMessageAt: Date;
  readonly status: ConversationStatus;
}

/** One lead's message thread and exchange-milestone counters (spec table `conversations`). Immutable — `SaveMessage` produces a new `Conversation` per call via `recordMessage`. */
export class Conversation {
  private constructor(private readonly props: ConversationProps) {}

  static create(props: ConversationProps): Result<Conversation, ValidationError> {
    if (props.messageCount < 0) {
      return err(new ValidationError("Conversation.messageCount must not be negative"));
    }
    return ok(new Conversation({ ...props }));
  }

  get id(): ConversationId {
    return this.props.id;
  }

  get leadId(): LeadId {
    return this.props.leadId;
  }

  get branchId(): BranchId {
    return this.props.branchId;
  }

  get wabaPhoneNumberId(): PhoneNumberId {
    return this.props.wabaPhoneNumberId;
  }

  get messageCount(): number {
    return this.props.messageCount;
  }

  get incomingCount(): number {
    return this.props.incomingCount;
  }

  get outgoingCount(): number {
    return this.props.outgoingCount;
  }

  get milestones(): ExchangeMilestones {
    return this.props.milestones;
  }

  get currentStage(): string {
    return this.props.currentStage;
  }

  get lastIntent(): string | undefined {
    return this.props.lastIntent;
  }

  get startedAt(): Date {
    return this.props.startedAt;
  }

  get lastMessageAt(): Date {
    return this.props.lastMessageAt;
  }

  get status(): ConversationStatus {
    return this.props.status;
  }

  /**
   * Records one new message (design resolution #1's exact pairing algorithm — see `SaveMessage`).
   * `exchangeCount` is the number of COMPLETE incoming+outgoing pairs after this message; the
   * caller (`SaveMessage`) computes it and passes the already-updated milestone flags in.
   */
  recordMessage(
    direction: "INCOMING" | "OUTGOING",
    milestones: ExchangeMilestones,
    at: Date,
  ): Conversation {
    return new Conversation({
      ...this.props,
      messageCount: this.props.messageCount + 1,
      incomingCount:
        direction === "INCOMING" ? this.props.incomingCount + 1 : this.props.incomingCount,
      outgoingCount:
        direction === "OUTGOING" ? this.props.outgoingCount + 1 : this.props.outgoingCount,
      milestones,
      lastMessageAt: at,
    });
  }

  withStage(currentStage: string, lastIntent?: string): Conversation {
    return new Conversation({
      ...this.props,
      currentStage,
      lastIntent: lastIntent ?? this.props.lastIntent,
    });
  }

  withStatus(status: ConversationStatus): Conversation {
    return new Conversation({ ...this.props, status });
  }
}
