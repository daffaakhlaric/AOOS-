import {
  Body,
  Controller,
  Get,
  Put,
  Headers,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { GrowthPolicyService } from "./growth-policy.service.js";

@Controller("api/v1/automation/growth-policy")
@UseGuards(ApiKeyGuard)
export class GrowthPolicyController {
  constructor(private readonly service: GrowthPolicyService) {}
  @Get() get(@TenantId() tenant: string) {
    return this.service.view(tenant);
  }
  @Get("versions") versions(@TenantId() tenant: string) {
    return this.service.versions(tenant);
  }
  @Put() save(
    @TenantId() tenant: string,
    @Headers("x-user-role") role: string,
    @Headers("x-user-id") actor: string,
    @Body() body: { expectedVersion: number; policy: unknown; reason?: string },
  ) {
    // Trusted server-to-server proxy supplies identity from the authenticated session, never browser input.
    if (!["OWNER", "ADMIN", "MANAGER", "SUPERADMIN"].includes(role?.toUpperCase()) || !actor)
      throw new ForbiddenException("Seorang admin workspace diperlukan.");
    if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 0)
      throw new BadRequestException("expectedVersion wajib diisi.");
    return this.service.save(tenant, body.expectedVersion, body.policy, actor, body.reason);
  }
}
