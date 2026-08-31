import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";

import { TenantId } from "../../common/tenant-context.js";
import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { SettingsResponseDto } from "./dto/settings-response.dto.js";
import {
  UpdateMetaSettingsBodySchema,
  type TestMetaConnectionResponseDto,
  type UpdateMetaSettingsBodyDto,
} from "./dto/update-meta-settings.dto.js";
import { UpdateModeBodySchema, type UpdateModeBodyDto } from "./dto/update-mode.dto.js";
import {
  CreateWabaConfigBodySchema,
  TestDraftWabaConnectionBodySchema,
  UpdateWabaConfigBodySchema,
  type CreateWabaConfigBodyDto,
  type TestDraftWabaConnectionBodyDto,
  type TestWabaConnectionResponseDto,
  type UpdateWabaConfigBodyDto,
  type WabaConfigResponseDto,
} from "./dto/waba-config.dto.js";
import { SettingsService } from "./settings.service.js";

/**
 * `GET/PUT /api/v1/settings*`, `GET/POST/PUT/DELETE /api/v1/settings/waba*` — `x-api-key` auth,
 * the same perimeter every other `aaos-api` endpoint sits behind. Tenant-scoped via `@TenantId()`
 * (`common/tenant-context.ts`), which reads the `x-tenant-id` header `apps/aaos-dashboard`'s
 * `/api/settings/*` route handlers forward from the caller's real session
 * (`getSession().tenantId`) — see that file's class doc for why this is the first genuinely
 * per-request-tenant-scoped module in this app.
 */
@Controller("api/v1/settings")
@UseGuards(ApiKeyGuard)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  async getSettings(@TenantId() tenantId: string): Promise<SettingsResponseDto> {
    return this.service.getSettings(tenantId);
  }

  @Put("meta")
  async updateMeta(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(UpdateMetaSettingsBodySchema)) body: UpdateMetaSettingsBodyDto,
  ): Promise<SettingsResponseDto> {
    return this.service.updateMeta(tenantId, body);
  }

  @Post("meta/test")
  @HttpCode(200)
  async testMeta(@TenantId() tenantId: string): Promise<TestMetaConnectionResponseDto> {
    return this.service.testMetaConnection(tenantId);
  }

  /** `PATCH /api/v1/settings/mode` — the new "Mode Operasi" card's confirm-dialog action (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase A point 4). */
  @Patch("mode")
  async updateMode(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(UpdateModeBodySchema)) body: UpdateModeBodyDto,
  ): Promise<SettingsResponseDto> {
    return this.service.updateMode(tenantId, body);
  }

  @Get("waba")
  async listWaba(@TenantId() tenantId: string): Promise<readonly WabaConfigResponseDto[]> {
    return this.service.listWaba(tenantId);
  }

  @Post("waba")
  async createWaba(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(CreateWabaConfigBodySchema)) body: CreateWabaConfigBodyDto,
  ): Promise<WabaConfigResponseDto> {
    return this.service.createWaba(tenantId, body);
  }

  @Put("waba/:id")
  async updateWaba(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateWabaConfigBodySchema)) body: UpdateWabaConfigBodyDto,
  ): Promise<WabaConfigResponseDto> {
    return this.service.updateWaba(tenantId, id, body);
  }

  @Delete("waba/:id")
  @HttpCode(200)
  async deleteWaba(
    @TenantId() tenantId: string,
    @Param("id") id: string,
  ): Promise<{ readonly deleted: true }> {
    await this.service.deleteWaba(tenantId, id);
    return { deleted: true };
  }

  @Post("waba/:id/test")
  @HttpCode(200)
  async testWaba(
    @TenantId() tenantId: string,
    @Param("id") id: string,
  ): Promise<TestWabaConnectionResponseDto> {
    return this.service.testWaba(tenantId, id);
  }

  /**
   * Tests a raw, UNSAVED `phoneNumberId`/`accessToken` pair from `WabaConfigModal`'s Add/Edit
   * form — distinct path from `waba/:id/test` above, which stays untouched and still serves the
   * saved-row test on the main Settings page's WABA list. No DB read, no DB write.
   */
  @Post("waba/test-draft")
  @HttpCode(200)
  async testWabaDraft(
    @Body(new ZodValidationPipe(TestDraftWabaConnectionBodySchema))
    body: TestDraftWabaConnectionBodyDto,
  ): Promise<TestWabaConnectionResponseDto> {
    return this.service.testWabaDraft(body.phoneNumberId, body.accessToken);
  }
}
