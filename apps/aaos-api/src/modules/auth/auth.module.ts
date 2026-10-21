import { Controller, Get, Global, Module, Req, UseGuards } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  TenantAuthorizationService,
  type TrustedTenantContext,
} from "./tenant-authorization.service.js";
@Controller("api/v1/auth")
@UseGuards(ApiKeyGuard)
class AuthContextController {
  @Get("context") context(
    @Req() request: FastifyRequest & { tenantContext: TrustedTenantContext },
  ) {
    return request.tenantContext;
  }
}
@Global()
@Module({
  controllers: [AuthContextController],
  providers: [TenantAuthorizationService, ApiKeyGuard],
  exports: [TenantAuthorizationService],
})
export class AuthModule {}
