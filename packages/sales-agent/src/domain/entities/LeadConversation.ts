import { err, ok, type Result } from "@aos/common";

import { ConversationError } from "../errors/ConversationError.js";
import type { BranchId } from "../value-objects/BranchId.js";
import { ConversationId } from "../value-objects/ConversationId.js";
import { ConversationStage } from "../value-objects/ConversationStage.js";
import { LeadScore } from "../value-objects/LeadScore.js";
import type { QualificationStatus } from "../value-objects/QualificationStatus.js";

import type { ConversationMessage } from "./ConversationMessage.js";
import { LeadProfile } from "./LeadProfile.js";

export interface LeadConversationProps {
  readonly id: ConversationId;
  readonly leadPhone: string;
  readonly branchId: BranchId;
  readonly stage: ConversationStage;
  readonly score: LeadScore;
  readonly profile: LeadProfile;
  readonly messages: ReadonlyArray<ConversationMessage>;
  readonly startedAt: Date;
  readonly lastMessageAt: Date;
  readonly closed: boolean;
  /**
   * How many times `StageDetector` has routed this conversation into `CLOSING` so far
   * (AAOS-W3D Fix 1). Optional/defaulted to `0` so every pre-existing `LeadConversation.create()`
   * call site (tests included) keeps compiling unchanged.
   */
  readonly closingAttemptCount?: number;
  /** The lead's score the last time a closing attempt was made — used to detect a "new signal" (score moved up) that re-permits closing past the 2-attempt cap (AAOS-W3D Fix 1). */
  readonly scoreAtLastClosingAttempt?: number;
  /** Which of the 4 core `QualificationStatus` criteria Jessy has already actively asked about — never re-asked (AAOS-W3D Fix 3). Optional/defaulted to empty for the same reason as `closingAttemptCount`. */
  readonly askedCriteria?: ReadonlySet<QualificationStatus>;
}

/**
 * Full conversation state between Jessy and one lead — the aggregate root `ConversationPipeline`
 * reads and rebuilds on every incoming message (spec: "Load conversation state (from memory —
 * persisted in W2E)"; this package holds it in-process only, per its explicit non-responsibility
 * "does NOT store conversations"). Immutable: every transition (`withAppendedMessage`,
 * `withStage`, `withScore`, `withProfile`, `withClosed`) returns a NEW instance.
 */
export class LeadConversation {
  private constructor(private readonly props: LeadConversationProps) {}

  static start(leadPhone: string, branchId: BranchId, startedAt: Date): LeadConversation {
    return new LeadConversation({
      id: ConversationId.fromParticipants(leadPhone, branchId),
      leadPhone,
      branchId,
      stage: ConversationStage.GREETING,
      score: LeadScore.zero(),
      profile: LeadProfile.empty(),
      messages: [],
      startedAt,
      lastMessageAt: startedAt,
      closed: false,
      closingAttemptCount: 0,
      scoreAtLastClosingAttempt: 0,
      askedCriteria: new Set(),
    });
  }

  static create(props: LeadConversationProps): Result<LeadConversation, ConversationError> {
    if (typeof props.leadPhone !== "string" || props.leadPhone.trim().length === 0) {
      return err(new ConversationError("LeadConversation.leadPhone must be a non-empty string"));
    }
    if (!Object.values(ConversationStage).includes(props.stage)) {
      return err(
        new ConversationError(
          `LeadConversation.stage must be a valid ConversationStage, received: ${String(props.stage)}`,
        ),
      );
    }
    return ok(
      new LeadConversation({
        ...props,
        messages: [...props.messages],
        closingAttemptCount: props.closingAttemptCount ?? 0,
        scoreAtLastClosingAttempt: props.scoreAtLastClosingAttempt ?? 0,
        askedCriteria: new Set(props.askedCriteria ?? []),
      }),
    );
  }

  get id(): ConversationId {
    return this.props.id;
  }

  get leadPhone(): string {
    return this.props.leadPhone;
  }

  get branchId(): BranchId {
    return this.props.branchId;
  }

  get stage(): ConversationStage {
    return this.props.stage;
  }

  get score(): LeadScore {
    return this.props.score;
  }

  get profile(): LeadProfile {
    return this.props.profile;
  }

  get messages(): ReadonlyArray<ConversationMessage> {
    return this.props.messages;
  }

  get startedAt(): Date {
    return this.props.startedAt;
  }

  get lastMessageAt(): Date {
    return this.props.lastMessageAt;
  }

  get closed(): boolean {
    return this.props.closed;
  }

  /** Number of inbound (lead-sent) messages so far — used as the deterministic seed for response-pool selection. */
  get inboundMessageCount(): number {
    return this.props.messages.filter((message) => message.isInbound).length;
  }

  /** How many times `StageDetector` has routed this conversation into `CLOSING` so far (AAOS-W3D Fix 1). */
  get closingAttemptCount(): number {
    return this.props.closingAttemptCount ?? 0;
  }

  /** The lead's score the last time a closing attempt was made (AAOS-W3D Fix 1). */
  get scoreAtLastClosingAttempt(): number {
    return this.props.scoreAtLastClosingAttempt ?? 0;
  }

  /** Which of the 4 core `QualificationStatus` criteria Jessy has already actively asked about (AAOS-W3D Fix 3). */
  get askedCriteria(): ReadonlySet<QualificationStatus> {
    return this.props.askedCriteria ?? new Set();
  }

  /** Records one more `CLOSING` attempt at the current score (AAOS-W3D Fix 1) — returns a NEW instance. */
  withClosingAttempt(): LeadConversation {
    return new LeadConversation({
      ...this.props,
      closingAttemptCount: this.closingAttemptCount + 1,
      scoreAtLastClosingAttempt: this.props.score.toNumber(),
    });
  }

  /** Records that Jessy actively asked about `criterion` (AAOS-W3D Fix 3) — returns a NEW instance. */
  withAskedCriterion(criterion: QualificationStatus): LeadConversation {
    const next = new Set(this.askedCriteria);
    next.add(criterion);
    return new LeadConversation({ ...this.props, askedCriteria: next });
  }

  withAppendedMessage(message: ConversationMessage, at: Date): LeadConversation {
    return new LeadConversation({
      ...this.props,
      messages: [...this.props.messages, message],
      lastMessageAt: at,
    });
  }

  withStage(stage: ConversationStage): LeadConversation {
    return new LeadConversation({ ...this.props, stage });
  }

  withScore(score: LeadScore): LeadConversation {
    return new LeadConversation({ ...this.props, score });
  }

  withProfile(profile: LeadProfile): LeadConversation {
    return new LeadConversation({ ...this.props, profile });
  }

  withClosed(closed: boolean): LeadConversation {
    return new LeadConversation({ ...this.props, closed });
  }

  /** Whether the lead has gone quiet past `timeoutMs`, as of `now` — drives `FollowUpService`'s `NO_REPLY` timeout path. */
  isStale(timeoutMs: number, now: Date): boolean {
    return now.getTime() - this.props.lastMessageAt.getTime() >= timeoutMs;
  }
}
