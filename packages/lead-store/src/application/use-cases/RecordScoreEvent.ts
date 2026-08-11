import { err, ErrorCode, ok, type Result } from "@aos/common";
import { z } from "zod";

import type { ILeadRepository } from "../../contracts/ILeadRepository.js";
import type { IScoringRepository } from "../../contracts/IScoringRepository.js";
import { ScoringEvent } from "../../domain/entities/ScoringEvent.js";
import { LeadNotFoundError } from "../../domain/errors/LeadNotFoundError.js";
import { LeadStoreError } from "../../domain/errors/LeadStoreError.js";
import type { LeadStoreEvents } from "../../domain/events/LeadStoreEvents.js";
import { LeadId } from "../../domain/value-objects/LeadId.js";
import {
  classifyTemperature,
  isPreAssignmentStatus,
  LeadStatus,
} from "../../domain/value-objects/LeadStatus.js";
import { ScoreReason } from "../../domain/value-objects/ScoreReason.js";

export interface RecordScoreEventInput {
  readonly leadId: string;
  readonly scoreBefore: number;
  readonly scoreAfter: number;
  readonly delta: number;
  readonly reason: ScoreReason;
  readonly triggeredBy?: string;
  readonly tenantId: string;
  readonly correlationId: string;
}

const RecordScoreEventInputSchema = z.object({
  leadId: z.string().min(1),
  scoreBefore: z.number(),
  scoreAfter: z.number(),
  delta: z.number(),
  reason: z.nativeEnum(ScoreReason),
  triggeredBy: z.string().optional(),
  tenantId: z.string().min(1),
  correlationId: z.string().min(1),
});

const MIN_SCORE = 0;
const MAX_SCORE = 100;
const HOT_THRESHOLD = 65;
const WARM_THRESHOLD = 31;

/**
 * Called by Jessy after each score change. Design resolution #6: the persisted score is always
 * `clamp(scoreAfter, 0, 100)` — the caller-supplied `scoreAfter` is treated as a hint, never
 * trusted un-clamped (pin: "100 + NOT_SERIOUS(-20) = 80, never below 0").
 *
 * Design resolution #2: `temperature` always reflects the new score's bucket. `status` is
 * overwritten with that same bucket ONLY when the lead's CURRENT status is still one of
 * `NEW | COLD | WARM | HOT` — a score change on an already-`ASSIGNED`/`CLOSED` lead never
 * reverts its workflow status. `becameHotAt` is set once (first crossing only) when the clamped
 * score reaches `>=65` while the lead is not yet `ASSIGNED`/`CLOSED`, and `LeadBecameHot` fires
 * only on that first crossing.
 */
export class RecordScoreEvent {
  constructor(
    private readonly leadRepository: ILeadRepository,
    private readonly scoringRepository: IScoringRepository,
    private readonly events: LeadStoreEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: RecordScoreEventInput): Promise<Result<ScoringEvent, LeadStoreError>> {
    const parsed = RecordScoreEventInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new LeadStoreError(`RecordScoreEvent input validation failed: ${parsed.error.message}`, {
          code: ErrorCode.VALIDATION_ERROR,
        }),
      );
    }

    const idResult = LeadId.create(parsed.data.leadId);
    if (!idResult.ok) {
      return err(new LeadStoreError(idResult.error.message, { code: ErrorCode.VALIDATION_ERROR }));
    }

    const findResult = await this.leadRepository.findById(idResult.value);
    if (!findResult.ok) {
      return err(findResult.error);
    }
    if (findResult.value === undefined) {
      return err(new LeadNotFoundError(`Lead not found: ${parsed.data.leadId}`));
    }
    const lead = findResult.value;

    const clampedScoreAfter = Math.min(MAX_SCORE, Math.max(MIN_SCORE, parsed.data.scoreAfter));
    const newTemperature = classifyTemperature(clampedScoreAfter, WARM_THRESHOLD, HOT_THRESHOLD);
    const canOverwriteStatus = isPreAssignmentStatus(lead.status);
    const becameHotNow =
      newTemperature === LeadStatus.HOT && lead.becameHotAt === undefined && canOverwriteStatus;
    const now = this.now();

    const eventResult = ScoringEvent.create({
      id: crypto.randomUUID(),
      leadId: idResult.value,
      scoreBefore: parsed.data.scoreBefore,
      scoreAfter: clampedScoreAfter,
      delta: parsed.data.delta,
      reason: parsed.data.reason,
      triggeredBy: parsed.data.triggeredBy,
      createdAt: now,
    });
    if (!eventResult.ok) {
      return err(
        new LeadStoreError(eventResult.error.message, { code: ErrorCode.VALIDATION_ERROR }),
      );
    }

    const insertResult = await this.scoringRepository.insert(eventResult.value);
    if (!insertResult.ok) {
      return err(insertResult.error);
    }

    const updatedLead = lead.withScore(
      clampedScoreAfter,
      newTemperature,
      now,
      becameHotNow ? now : undefined,
    );
    const updateResult = await this.leadRepository.update(updatedLead);
    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    await this.events.publishScoreUpdated({
      leadId: idResult.value.toString(),
      scoreBefore: parsed.data.scoreBefore,
      scoreAfter: clampedScoreAfter,
      delta: parsed.data.delta,
      reason: parsed.data.reason,
      tenantId: parsed.data.tenantId,
      correlationId: parsed.data.correlationId,
      occurredAt: now,
      version: "1.0",
    });

    if (becameHotNow) {
      await this.events.publishLeadBecameHot({
        leadId: idResult.value.toString(),
        branchId: lead.branchId,
        score: clampedScoreAfter,
        becameHotAt: now,
        tenantId: parsed.data.tenantId,
        correlationId: parsed.data.correlationId,
        occurredAt: now,
        version: "1.0",
      });
    }

    return ok(insertResult.value);
  }
}
