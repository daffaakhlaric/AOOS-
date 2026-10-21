import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CreativeStressTestService } from "./creative-stress-test.service.js";
import { OBJECTION_SOURCES } from "./domain/objection-sources.js";
import { PERSONA_PRESETS, PERSONA_PRESETS_VERSION } from "./domain/persona-presets.js";
import {
  CreateStressTestRunBodySchema,
  type CreateStressTestRunBodyDto,
} from "./dto/create-stress-test-run.dto.js";
import {
  toStressTestRunResponseDto,
  type StressTestRunResponseDto,
} from "./dto/stress-test-run-response.dto.js";

/**
 * `/api/v1/creative-stress-test*` — `x-api-key` auth (mirrors `AbTestingController`'s own
 * discipline), every read/write tenant-scoped via `@TenantId()` (same `common/tenant-context.ts`
 * convention). Backs the `/samantha/stress-test` list page and `/samantha/stress-test/run` builder
 * page. First Boundary only — see `CreativeStressTestService`'s own doc for scope.
 *
 * Deliberately does NOT reuse or extend `SimulationController`/`/api/v1/simulation*` — separate
 * feature, separate routes, per this module's naming-collision warning.
 */
@Controller("api/v1/creative-stress-test")
@UseGuards(ApiKeyGuard)
export class CreativeStressTestController {
  constructor(private readonly service: CreativeStressTestService) {}

  /** Static config, not tenant-scoped: the 5 real, versioned persona presets. */
  @Get("persona-presets")
  personaPresets(): { readonly version: number; readonly presets: typeof PERSONA_PRESETS } {
    return { version: PERSONA_PRESETS_VERSION, presets: PERSONA_PRESETS };
  }

  /** Static config, not tenant-scoped: the objection source selector's real/honest-gap map. */
  @Get("objection-sources")
  objectionSources(): typeof OBJECTION_SOURCES {
    return OBJECTION_SOURCES;
  }

  @Get()
  async list(@TenantId() tenantId: string): Promise<readonly StressTestRunResponseDto[]> {
    const runs = await this.service.listRuns(tenantId);
    return runs.map(toStressTestRunResponseDto);
  }

  @Get(":id")
  async byId(
    @Param("id") id: string,
    @TenantId() tenantId: string,
  ): Promise<StressTestRunResponseDto> {
    const run = await this.service.getRun(id, tenantId);
    return toStressTestRunResponseDto(run);
  }

  @Post()
  @HttpCode(201)
  async create(
    @Body(new ZodValidationPipe(CreateStressTestRunBodySchema)) body: CreateStressTestRunBodyDto,
    @TenantId() tenantId: string,
  ): Promise<StressTestRunResponseDto> {
    const run = await this.service.createRun(body, tenantId);
    return toStressTestRunResponseDto(run);
  }

  @Post(":id/execute")
  @HttpCode(200)
  async execute(
    @Param("id") id: string,
    @TenantId() tenantId: string,
  ): Promise<StressTestRunResponseDto> {
    const run = await this.service.execute(id, tenantId);
    return toStressTestRunResponseDto(run);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  async cancel(
    @Param("id") id: string,
    @TenantId() tenantId: string,
  ): Promise<StressTestRunResponseDto> {
    const run = await this.service.cancel(id, tenantId);
    return toStressTestRunResponseDto(run);
  }
}
