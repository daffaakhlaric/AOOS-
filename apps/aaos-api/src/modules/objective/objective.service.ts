import { NotFoundError } from "@aos/errors";
import type { ObjectiveEngine } from "@aos/objective-engine";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, OBJECTIVE_ENGINE } from "../../di-tokens.js";

import type { CreateObjectiveBodyDto } from "./dto/create-objective.dto.js";
import { toObjectiveResponseDto, type ObjectiveResponseDto } from "./dto/objective-response.dto.js";

/**
 * Wires `CreateObjective`/`ObjectiveRegistry` from `@aos/objective-engine`, translating between
 * this app's HTTP DTOs and the package's domain types. Consistent error-translation pattern with
 * `LeadsService`: on `Result.err(...)`, re-throws the raw `@aos/objective-engine` error instance
 * — never a Nest `HttpException` — so `AaosExceptionFilter` decides the resulting HTTP status.
 */
@Injectable()
export class ObjectiveService {
  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(OBJECTIVE_ENGINE) private readonly engine: ObjectiveEngine,
  ) {}

  /**
   * "Current objective" = the most recently created Objective for this tenant (there is at most
   * one active/draft one per month by `@aos/objective-engine`'s own `maxObjectivesPerMonth`
   * default, but this picks the newest by `createdAt` regardless of status so a just-completed
   * or cancelled objective doesn't make this endpoint appear to have nothing).
   */
  getCurrentObjective(): ObjectiveResponseDto {
    const all = this.engine.registry.listByTenant(this.config.AAOS_TENANT_ID);
    if (all.length === 0) {
      throw new NotFoundError(`No Objective found for tenant "${this.config.AAOS_TENANT_ID}"`);
    }
    const current = [...all].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    /* v8 ignore next 3 -- unreachable: `all.length > 0` was already checked above. */
    if (current === undefined) {
      throw new NotFoundError(`No Objective found for tenant "${this.config.AAOS_TENANT_ID}"`);
    }
    return toObjectiveResponseDto(current);
  }

  async createObjective(
    body: CreateObjectiveBodyDto,
    correlationId: string,
  ): Promise<ObjectiveResponseDto> {
    const now = new Date();
    const result = await this.engine.createObjective.execute({
      tenantId: this.config.AAOS_TENANT_ID,
      period: { month: now.getUTCMonth() + 1, year: now.getUTCFullYear() },
      targetHotLeads: body.targetHotLeads,
      budgetAllocation: body.budgetAllocation,
      focusUnits: body.focusUnits,
      areaPriorities: body.areaPriorities,
      correlationId,
    });
    if (!result.ok) {
      throw result.error;
    }
    return toObjectiveResponseDto(result.value);
  }
}
