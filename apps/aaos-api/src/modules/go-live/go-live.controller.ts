import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";

import { CorrelationId } from "../../common/correlation.js";
import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import type { SimulationStatusResponseDto } from "../simulation/dto/simulation-status.dto.js";

import { GoLiveBodySchema, type GoLiveBodyDto } from "./dto/go-live-body.dto.js";
import { RollbackBodySchema, type RollbackBodyDto } from "./dto/rollback-body.dto.js";
import { GoLiveService } from "./go-live.service.js";

/**
 * `POST /api/v1/simulation/:id/go-live`, `POST /api/v1/simulation/:id/rollback`,
 * `GET /api/v1/simulation/live` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 4). A separate
 * controller from `SimulationController`, same base path (`api/v1/simulation`) — Nest allows
 * multiple controllers to share a prefix; kept as its own module since Go Live's dependencies
 * (`WabaConfigRepository`, the connector's new use cases) are a distinct concern from the original
 * 6-step Simulasi pipeline. `x-api-key` auth, matching every other controller in this app.
 *
 * TENANT-SCOPING FIX (Phase T2, docs/PROMPT-AAOS-META-ADS-TENANT-SCOPING.md): `goLive`/`pause`/
 * `rollback` each ultimately call `GoLiveService`'s `connectorRegistry.resolve`, so all 3 now
 * resolve the real per-request tenant via `@TenantId()` (`common/tenant-context.ts` — the same
 * `AssetsController` convention Phase T1 already established) and thread it into `GoLiveService`,
 * instead of the service reading the single, process-wide `AAOS_TENANT_ID` env var. `listLive`
 * reads only `SimulationRepository` (no connector resolve anywhere in its call path) — left as-is.
 */
@Controller("api/v1/simulation")
@UseGuards(ApiKeyGuard)
export class GoLiveController {
  constructor(private readonly service: GoLiveService) {}

  /** Route registered before `SimulationController`'s `:id/status` conflicts are impossible (different segment counts), but declared first here anyway, matching this app's existing "literal route before :id-shaped route" convention. */
  @Get("live")
  async listLive(): Promise<readonly SimulationStatusResponseDto[]> {
    return this.service.listLive();
  }

  @Post(":id/go-live")
  @HttpCode(200)
  async goLive(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(GoLiveBodySchema)) body: GoLiveBodyDto,
    @CorrelationId() correlationId: string,
    @TenantId() tenantId: string,
  ): Promise<SimulationStatusResponseDto> {
    return this.service.execute(id, body, correlationId, tenantId);
  }

  @Post(":id/pause")
  @HttpCode(200)
  async pause(
    @Param("id") id: string,
    @CorrelationId() correlationId: string,
    @TenantId() tenantId: string,
  ): Promise<SimulationStatusResponseDto> {
    return this.service.pauseLive(id, correlationId, tenantId);
  }

  @Post(":id/rollback")
  @HttpCode(200)
  async rollback(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(RollbackBodySchema)) body: RollbackBodyDto,
    @CorrelationId() correlationId: string,
    @TenantId() tenantId: string,
  ): Promise<SimulationStatusResponseDto> {
    return this.service.rollback(id, body, correlationId, tenantId);
  }
}
