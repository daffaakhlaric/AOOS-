import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";
import { z } from "zod";

import type { IObjectiveRepository } from "../../contracts/IObjectiveRepository.js";
import type { Objective } from "../../domain/entities/Objective.js";
import {
  InvalidObjectiveError,
  ObjectiveNotFoundError,
  type ObjectiveError,
} from "../../domain/errors/index.js";
import type { ObjectiveEngineEvents } from "../../domain/events/ObjectiveEngineEvents.js";
import { AreaPriority } from "../../domain/value-objects/AreaPriority.js";
import { BudgetAllocation } from "../../domain/value-objects/BudgetAllocation.js";
import { FocusUnit } from "../../domain/value-objects/FocusUnit.js";
import type { ObjectiveId } from "../../domain/value-objects/ObjectiveId.js";
import { TargetLeads } from "../../domain/value-objects/TargetLeads.js";

const UpdateObjectiveInputSchema = z.object({
  targetHotLeads: z.number().optional(),
  budgetAllocation: z.number().optional(),
  focusUnits: z.array(z.string()).min(1).optional(),
  areaPriorities: z.array(z.string()).min(1).optional(),
  correlationId: z.string().min(1),
});

export interface UpdateObjectiveInput {
  readonly objectiveId: ObjectiveId;
  readonly targetHotLeads?: number;
  readonly budgetAllocation?: number;
  readonly focusUnits?: ReadonlyArray<string>;
  readonly areaPriorities?: ReadonlyArray<string>;
  readonly correlationId: string;
}

/** Applies a partial update to an existing Objective's target/budget/focus/areas and re-saves it (spec: "UpdateObjective"). */
export class UpdateObjective {
  constructor(
    private readonly repository: IObjectiveRepository,
    private readonly events: ObjectiveEngineEvents,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: UpdateObjectiveInput): Promise<Result<Objective, ObjectiveError>> {
    const parsed = UpdateObjectiveInputSchema.safeParse(input);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      return err(new InvalidObjectiveError(`UpdateObjective input validation failed: ${details}`));
    }

    const found = this.repository.findById(input.objectiveId);
    if (!found.some) {
      return err(
        new ObjectiveNotFoundError(`No Objective found with id "${input.objectiveId.toString()}"`),
      );
    }
    const existing = found.value;

    const updates: {
      targetHotLeads?: TargetLeads;
      budgetAllocation?: BudgetAllocation;
      focusUnits?: FocusUnit[];
      areaPriorities?: AreaPriority[];
    } = {};

    if (input.targetHotLeads !== undefined) {
      const result = TargetLeads.create(input.targetHotLeads);
      if (!result.ok) {
        return err(new InvalidObjectiveError(result.error.message));
      }
      updates.targetHotLeads = result.value;
    }

    if (input.budgetAllocation !== undefined) {
      const result = BudgetAllocation.create(input.budgetAllocation);
      if (!result.ok) {
        return err(new InvalidObjectiveError(result.error.message));
      }
      updates.budgetAllocation = result.value;
    }

    if (input.focusUnits !== undefined) {
      const focusUnits: FocusUnit[] = [];
      for (const raw of input.focusUnits) {
        const result = FocusUnit.create(raw);
        if (!result.ok) {
          return err(new InvalidObjectiveError(result.error.message));
        }
        focusUnits.push(result.value);
      }
      updates.focusUnits = focusUnits;
    }

    if (input.areaPriorities !== undefined) {
      const areaPriorities: AreaPriority[] = [];
      for (const raw of input.areaPriorities) {
        const result = AreaPriority.create(raw);
        if (!result.ok) {
          return err(new InvalidObjectiveError(result.error.message));
        }
        areaPriorities.push(result.value);
      }
      updates.areaPriorities = areaPriorities;
    }

    const updated = existing.withUpdates(updates);
    this.repository.save(updated);

    await this.events.publishObjectiveUpdated({
      objectiveId: updated.id.toString(),
      tenantId: updated.tenantId,
      targetHotLeads: updated.targetHotLeads.toNumber(),
      budgetAllocation: updated.budgetAllocation.toNumber(),
      focusUnits: updated.focusUnits.map((f) => f.toString()),
      areaPriorities: updated.areaPriorities.map((a) => a.toBranch().toString()),
      correlationId: input.correlationId,
      occurredAt: this.now(),
      version: "1.0",
    });

    this.logger.info({ objectiveId: updated.id.toString() }, "objective-engine: objective updated");

    return ok(updated);
  }
}
