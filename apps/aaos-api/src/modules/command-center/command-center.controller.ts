import { Controller, Get, UseGuards } from "@nestjs/common";

import { CorrelationId } from "../../common/correlation.js";
import { TenantId } from "../../common/tenant-context.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CommandCenterService } from "./command-center.service.js";
import type { AccountSummaryResponseDto } from "./dto/account-summary-response.dto.js";

/**
 * `GET /api/v1/command-center/account-summary` — `x-api-key` auth (same perimeter as every other
 * `aaos-api` module), tenant-scoped via `@TenantId()`. The one real, account-wide aggregate the
 * Command Center dashboard's Needs Attention / Opportunities / Samantha Decision Queue sections
 * need — see `CommandCenterService`'s own doc for exactly which real services/domain functions it
 * composes.
 */
@Controller("api/v1/command-center")
@UseGuards(ApiKeyGuard)
export class CommandCenterController {
  constructor(private readonly service: CommandCenterService) {}

  @Get("account-summary")
  async getAccountSummary(
    @TenantId() tenantId: string,
    @CorrelationId() correlationId: string,
  ): Promise<AccountSummaryResponseDto> {
    return this.service.getAccountSummary(tenantId, correlationId);
  }
}
