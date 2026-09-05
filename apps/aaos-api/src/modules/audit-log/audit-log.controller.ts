import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { AuditLogService } from "./audit-log.service.js";
import {
  RollbackAuditLogBodySchema,
  toAuditLogResponseDto,
  type AuditLogResponseDto,
  type RollbackAuditLogBodyDto,
} from "./dto/audit-log.dto.js";

/**
 * `api/v1/audit-log*` (AAOS LOOP UPGRADE, Sprint 6 Prompt 17) — real HTTP surface for the Audit
 * sub-tab. `x-api-key` auth via `ApiKeyGuard`, the same convention every other manager-facing
 * controller in this app already uses. Every route is `@TenantId()`-scoped from day one.
 */
@Controller("api/v1/audit-log")
@UseGuards(ApiKeyGuard)
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query("agent") agent?: string,
  ): Promise<readonly AuditLogResponseDto[]> {
    const rows = await this.service.list(tenantId, agent);
    return rows.map(toAuditLogResponseDto);
  }

  @Get(":id")
  async get(@TenantId() tenantId: string, @Param("id") id: string): Promise<AuditLogResponseDto> {
    const row = await this.service.get(tenantId, id);
    return toAuditLogResponseDto(row);
  }

  @Post(":id/rollback")
  @HttpCode(200)
  async rollback(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(RollbackAuditLogBodySchema)) body: RollbackAuditLogBodyDto,
  ): Promise<AuditLogResponseDto> {
    const row = await this.service.rollback(tenantId, id, body.decidedBy);
    return toAuditLogResponseDto(row);
  }
}
