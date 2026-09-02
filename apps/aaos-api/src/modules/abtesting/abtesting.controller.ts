import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { AbTestingService } from "./abtesting.service.js";
import { toAbTestResponseDto, type AbTestResponseDto } from "./dto/ab-test-response.dto.js";
import {
  CreateAbTestBodySchema,
  ListAbTestsQuerySchema,
  type CreateAbTestBodyDto,
  type ListAbTestsQueryDto,
} from "./dto/create-ab-test.dto.js";

/**
 * `/api/v1/abtesting*` — `x-api-key` auth, same discipline as every other write endpoint in this
 * app (AAOS-ABTESTING-LOOKALIKE). Backs `/meta-ads/abtesting`'s tabs + "Buat A/B Test Baru" modal.
 *
 * TENANT-SCOPING FIX (Phase T2, docs/PROMPT-AAOS-META-ADS-TENANT-SCOPING.md): every endpoint here
 * scopes its `AbTestingService`/repository reads and writes by tenant, so all 4 now resolve the
 * real per-request tenant via `@TenantId()` (`common/tenant-context.ts` — the same
 * `AssetsController` convention Phase T1 already established) instead of `AbTestingService`
 * reading a private `tenantId` getter aliasing the single, process-wide `AAOS_TENANT_ID` env var.
 */
@Controller("api/v1/abtesting")
@UseGuards(ApiKeyGuard)
export class AbTestingController {
  constructor(private readonly service: AbTestingService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(ListAbTestsQuerySchema)) query: ListAbTestsQueryDto,
    @TenantId() tenantId: string,
  ): Promise<readonly AbTestResponseDto[]> {
    const tests = await this.service.listTests(tenantId, query.status);
    const withVariants = await Promise.all(
      tests.map(async (test) => {
        const { variants } = await this.service.getTest(test.id, tenantId);
        return toAbTestResponseDto(test, variants);
      }),
    );
    return withVariants;
  }

  @Get(":id")
  async byId(@Param("id") id: string, @TenantId() tenantId: string): Promise<AbTestResponseDto> {
    const { test, variants } = await this.service.getTest(id, tenantId);
    return toAbTestResponseDto(test, variants);
  }

  @Post()
  @HttpCode(201)
  async create(
    @Body(new ZodValidationPipe(CreateAbTestBodySchema)) body: CreateAbTestBodyDto,
    @TenantId() tenantId: string,
  ): Promise<AbTestResponseDto> {
    const test = await this.service.createTest(body, tenantId);
    const { variants } = await this.service.getTest(test.id, tenantId);
    return toAbTestResponseDto(test, variants);
  }

  @Post(":id/pause")
  @HttpCode(200)
  async pause(@Param("id") id: string, @TenantId() tenantId: string): Promise<AbTestResponseDto> {
    const test = await this.service.pauseTest(id, tenantId);
    const { variants } = await this.service.getTest(id, tenantId);
    return toAbTestResponseDto(test, variants);
  }
}
