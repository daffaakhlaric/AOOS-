import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";
import type { getTracer } from "@aos/telemetry";
import { z } from "zod";

import type { ObjectiveEngineConfig } from "../../config/ObjectiveEngineConfig.js";
import type { IObjectiveRepository } from "../../contracts/IObjectiveRepository.js";
import type { Objective } from "../../domain/entities/Objective.js";
import { InvalidObjectiveError, type ObjectiveError } from "../../domain/errors/index.js";
import type { ObjectiveEngineEvents } from "../../domain/events/ObjectiveEngineEvents.js";
import { ObjectiveId } from "../../domain/value-objects/ObjectiveId.js";
import { ObjectivePeriod } from "../../domain/value-objects/ObjectivePeriod.js";
import { ObjectiveStatus } from "../../domain/value-objects/ObjectiveStatus.js";
import { ObjectiveFactory } from "../../factories/ObjectiveFactory.js";

/** Local alias avoiding a direct `@opentelemetry/api` dependency, mirroring `@aos/meta-ads-connector`'s `PullCampaignData.ts`. */
export type Tracer = ReturnType<typeof getTracer>;

const CreateObjectiveInputSchema = z.object({
  tenantId: z.string().min(1),
  period: z.object({ month: z.number().int(), year: z.number().int() }),
  // `targetHotLeads > 0` is already enforced by `TargetLeads`' smart constructor (never allows
  // <= 0), so no `.positive()` is needed here. `budgetAllocation`, however, shares its Value
  // Object (`BudgetAllocation`) with `ObjectiveProgress.currentSpend`/`projectedBudgetAtEnd`,
  // both of which must legitimately allow 0 — so `BudgetAllocation` itself permits 0. The spec's
  // "budgetAllocation > 0" validation is therefore enforced here, at the use-case boundary,
  // instead of at the Value Object.
  targetHotLeads: z.number(),
  budgetAllocation: z.number().positive(),
  focusUnits: z.array(z.string()).min(1),
  areaPriorities: z.array(z.string()).min(1),
  correlationId: z.string().min(1),
});

export type CreateObjectiveInput = z.infer<typeof CreateObjectiveInputSchema>;

/**
 * Creates and stores a new DSS Motor monthly Objective (spec: "CreateObjective"). Validation
 * order: Zod shape → Value Object smart constructors → "period must be current or future month"
 * → "max N active objectives per tenant per month" (`config.maxObjectivesPerMonth`, default 1).
 */
export class CreateObjective {
  constructor(
    private readonly repository: IObjectiveRepository,
    private readonly events: ObjectiveEngineEvents,
    private readonly config: ObjectiveEngineConfig,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: CreateObjectiveInput): Promise<Result<Objective, ObjectiveError>> {
    return this.tracer.startActiveSpan(
      "objective-engine.create-objective",
      async (span: { end: () => void }) => {
        try {
          return await this.run(input);
        } finally {
          span.end();
        }
      },
    );
  }

  private async run(input: CreateObjectiveInput): Promise<Result<Objective, ObjectiveError>> {
    const parsed = CreateObjectiveInputSchema.safeParse(input);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      return err(new InvalidObjectiveError(`CreateObjective input validation failed: ${details}`));
    }
    const data = parsed.data;

    const periodResult = ObjectivePeriod.create(data.period);
    if (!periodResult.ok) {
      return err(new InvalidObjectiveError(periodResult.error.message));
    }

    const now = this.now();
    if (!periodResult.value.isCurrentOrFuture(now)) {
      return err(
        new InvalidObjectiveError(
          `Objective period ${periodResult.value.toKey()} must be the current or a future month`,
        ),
      );
    }

    const existingCount = this.countActiveForPeriod(data.tenantId, periodResult.value);
    if (existingCount >= this.config.maxObjectivesPerMonth) {
      return err(
        new InvalidObjectiveError(
          `Tenant "${data.tenantId}" already has ${existingCount} active objective(s) for ${periodResult.value.toKey()} (max ${this.config.maxObjectivesPerMonth})`,
        ),
      );
    }

    const objectiveResult = ObjectiveFactory.create({
      id: ObjectiveId.generate(),
      tenantId: data.tenantId,
      period: data.period,
      targetHotLeads: data.targetHotLeads,
      budgetAllocation: data.budgetAllocation,
      focusUnits: data.focusUnits,
      areaPriorities: data.areaPriorities,
      status: ObjectiveStatus.DRAFT,
      createdAt: now,
    });
    if (!objectiveResult.ok) {
      return err(new InvalidObjectiveError(objectiveResult.error.message));
    }
    const objective = objectiveResult.value;

    this.repository.save(objective);

    await this.events.publishObjectiveCreated({
      objectiveId: objective.id.toString(),
      tenantId: data.tenantId,
      period: { month: periodResult.value.monthNumber, year: periodResult.value.yearNumber },
      targetHotLeads: objective.targetHotLeads.toNumber(),
      budgetAllocation: objective.budgetAllocation.toNumber(),
      focusUnits: objective.focusUnits.map((f) => f.toString()),
      areaPriorities: objective.areaPriorities.map((a) => a.toBranch().toString()),
      correlationId: data.correlationId,
      occurredAt: now,
      version: "1.0",
    });

    this.logger.info(
      { objectiveId: objective.id.toString(), tenantId: data.tenantId },
      "objective-engine: objective created",
    );

    return ok(objective);
  }

  /**
   * Counts every ACTIVE/DRAFT Objective for `tenantId`/`period` — not just whether one exists —
   * so `config.maxObjectivesPerMonth` is correctly enforced even when configured above the
   * default of 1 (a plain `findActiveByTenantAndPeriod` existence check would incorrectly cap
   * out at 1, never blocking a 3rd/4th objective when the configured max is 2+).
   */
  private countActiveForPeriod(tenantId: string, period: ObjectivePeriod): number {
    return this.repository
      .listByTenant(tenantId)
      .filter(
        (objective) =>
          objective.period.equals(period) &&
          (objective.status === ObjectiveStatus.ACTIVE ||
            objective.status === ObjectiveStatus.DRAFT),
      ).length;
  }
}
