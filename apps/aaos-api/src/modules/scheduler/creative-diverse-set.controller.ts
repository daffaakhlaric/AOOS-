import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  DiverseCreativeBriefSetBodySchema,
  type DiverseCreativeBriefSetBodyDto,
  type DiverseCreativeBriefSetResultDto,
} from "./dto/diverse-creative-brief-set.dto.js";
import { SchedulerService } from "./scheduler.service.js";

/**
 * `POST /api/v1/creative-packages/diverse-set` (Samantha Andromeda-Aware Campaign System, Sprint 2)
 * — a DEDICATED, thin controller registered under `SchedulerModule` (not `CreativePackagesModule`)
 * because it delegates to `SchedulerService.createDiverseCreativeBriefSet`, the real orchestration
 * home — see that method's own doc for exactly why (a 3-way `PropertyObjectiveService`/
 * `PendingActionsService`/`CreativePackagesService` dependency only `SchedulerModule` already wires
 * without a circular import). The route path (`api/v1/creative-packages/...`) matches this
 * codebase's real existing `CreativePackagesController` prefix, not `SchedulerModule`'s own
 * `api/v1/calendar` prefix — Nest routes are independent of which module registers the controller,
 * and a `creative-packages`-prefixed path is the honest REST shape for "create creative_packages
 * rows", regardless of which module's service does the real work under the hood.
 */
@Controller("api/v1/creative-packages")
@UseGuards(ApiKeyGuard)
export class CreativeDiverseSetController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post("diverse-set")
  @HttpCode(201)
  async createDiverseSet(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(DiverseCreativeBriefSetBodySchema))
    body: DiverseCreativeBriefSetBodyDto,
  ): Promise<DiverseCreativeBriefSetResultDto> {
    return this.schedulerService.createDiverseCreativeBriefSet(
      tenantId,
      body.listingId,
      body.requestedCount,
      body.campaignId,
    );
  }
}
