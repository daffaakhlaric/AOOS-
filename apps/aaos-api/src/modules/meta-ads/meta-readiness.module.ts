import type { SupabaseClientLike } from "@aos/lead-store";
import { Body, Controller, Get, Global, Module, Put, Req, UseGuards } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import type { TrustedTenantContext } from "../auth/tenant-authorization.service.js";
import { ListingsModule } from "../listings/listings.module.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";


import { ApiKeyGuard } from "./guards/api-key.guard.js";
import { MetaExecutionReadinessService } from "./meta-execution-readiness.service.js";
const selection = z
  .object({
    credentialVersion: z.number().int().positive(),
    pageId: z.string().regex(/^\d+$/),
    instagramId: z.string().regex(/^\d+$/).nullable().optional(),
    whatsappNumber: z.string().min(5).max(40).nullable().optional(),
  })
  .strict();
@Controller("api/v1/meta-integration")
@UseGuards(ApiKeyGuard)
class MetaReadinessController {
  constructor(private readonly service: MetaExecutionReadinessService) {}
  @Get("health") health(@Req() request: FastifyRequest & { tenantContext: TrustedTenantContext }) {
    return this.service.inspect(request.tenantContext);
  }
  @Get("resources") resources(
    @Req() request: FastifyRequest & { tenantContext: TrustedTenantContext },
  ) {
    return this.service.resources(request.tenantContext);
  }
  @Put("destinations") select(
    @Req() request: FastifyRequest & { tenantContext: TrustedTenantContext },
    @Body(new ZodValidationPipe(selection)) body: z.infer<typeof selection>,
  ) {
    return this.service.selectDestinations(request.tenantContext, body);
  }
}
@Global()
@Module({
  imports: [ListingsModule],
  controllers: [MetaReadinessController],
  providers: [
    MetaExecutionReadinessService,
    ApiKeyGuard,
    {
      provide: TenantRepository,
      useFactory: (client: SupabaseClientLike) => new TenantRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [MetaExecutionReadinessService],
})
export class MetaReadinessModule {}
