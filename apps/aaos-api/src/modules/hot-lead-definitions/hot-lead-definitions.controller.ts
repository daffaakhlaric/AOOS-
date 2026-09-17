import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  PutHotLeadDefinitionBodySchema,
  type HotLeadDefinitionResponseDto,
  type PutHotLeadDefinitionBodyDto,
} from "./dto/hot-lead-definition.dto.js";
import { HotLeadDefinitionsService } from "./hot-lead-definitions.service.js";

/**
 * `GET/PUT /api/v1/hot-lead-definitions` — `x-api-key` auth, tenant-scoped via `@TenantId()`.
 *
 * `GET` returns `null` (HTTP 200, not 404) when the tenant hasn't configured a definition yet —
 * same "a real, honest empty/absent representation, not an error" choice `WabaConfigController`'s
 * `listWaba` makes by returning an empty array rather than a 404 for a tenant with no WABA config.
 * A 404 in this codebase's convention (`AaosExceptionFilter`'s `NotFoundError -> 404` mapping) is
 * reserved for "this specific id doesn't exist / isn't yours" lookups (`GET /listings/:id`, etc.)
 * — `GET /hot-lead-definitions` has no `:id`, it's a per-tenant singleton whose "not configured"
 * state is a legitimate, expected response shape the frontend must handle by prompting the tenant
 * to define one (per `HotLeadDefinitionsService.get`'s own doc), not an exceptional error.
 */
@Controller("api/v1/hot-lead-definitions")
@UseGuards(ApiKeyGuard)
export class HotLeadDefinitionsController {
  constructor(private readonly service: HotLeadDefinitionsService) {}

  @Get()
  async get(@TenantId() tenantId: string): Promise<HotLeadDefinitionResponseDto | null> {
    const definition = await this.service.get(tenantId);
    return definition ?? null;
  }

  @Put()
  async set(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(PutHotLeadDefinitionBodySchema)) body: PutHotLeadDefinitionBodyDto,
  ): Promise<HotLeadDefinitionResponseDto> {
    return this.service.set(tenantId, body);
  }
}
