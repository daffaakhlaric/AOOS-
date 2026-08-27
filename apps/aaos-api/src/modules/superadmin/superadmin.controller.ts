import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from "@nestjs/common";

import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CreateTenantBodySchema, type CreateTenantBodyDto } from "./dto/create-tenant.dto.js";
import {
  ImpersonateBodySchema,
  type ImpersonateBodyDto,
  type ImpersonateResponseDto,
} from "./dto/impersonate.dto.js";
import type { ListTenantsResponseDto, TenantResponseDto } from "./dto/tenant-response.dto.js";
import { UpdateTenantBodySchema, type UpdateTenantBodyDto } from "./dto/update-tenant.dto.js";
import {
  PutWebhookConfigBodySchema,
  type PutWebhookConfigBodyDto,
  type WebhookConfigResponseDto,
} from "./dto/webhook-config.dto.js";
import { SuperadminService } from "./superadmin.service.js";

/**
 * `GET/POST /api/v1/superadmin/tenants`, `PUT /api/v1/superadmin/tenants/:id`,
 * `POST /api/v1/superadmin/impersonate` — `x-api-key` auth, the same perimeter every other
 * `aaos-api` endpoint sits behind (only `apps/aaos-dashboard`'s server holds this key — see
 * `lib/api.ts`'s class doc). The REAL `role === 'superadmin'` check happens one layer up, in
 * `apps/aaos-dashboard`'s `/api/superadmin/*` route handlers (`getSession()` reading the caller's
 * actual Supabase Auth session before ever proxying here) — this app has no notion of "which
 * dashboard user" made a request, only "a trusted dashboard server did", exactly like every other
 * `x-api-key`-gated endpoint in this codebase (`SalesHumansController`, `MetaAdsController`, ...).
 * `POST /api/v1/superadmin/login` from the raw spec's Part 1/9 is deliberately NOT implemented
 * here — coordinator note #1: Super Admin sign-in reuses the exact same
 * `supabase.auth.signInWithPassword` flow as every other login, entirely client-side against
 * Supabase directly (see `apps/aaos-dashboard/src/app/(auth)/superadmin/login/page.tsx`), so
 * there is no server "login" endpoint to add — `aaos-api` never sees a password.
 */
@Controller("api/v1/superadmin")
@UseGuards(ApiKeyGuard)
export class SuperadminController {
  constructor(private readonly service: SuperadminService) {}

  @Get("tenants")
  async listTenants(): Promise<ListTenantsResponseDto> {
    return this.service.list();
  }

  @Post("tenants")
  async createTenant(
    @Body(new ZodValidationPipe(CreateTenantBodySchema)) body: CreateTenantBodyDto,
  ): Promise<TenantResponseDto> {
    return this.service.create(body);
  }

  @Put("tenants/:id")
  async updateTenant(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateTenantBodySchema)) body: UpdateTenantBodyDto,
  ): Promise<TenantResponseDto> {
    return this.service.update(id, body);
  }

  @Post("impersonate")
  @HttpCode(200)
  async impersonate(
    @Body(new ZodValidationPipe(ImpersonateBodySchema)) body: ImpersonateBodyDto,
  ): Promise<ImpersonateResponseDto> {
    return this.service.impersonate(body);
  }

  /**
   * `GET /api/v1/superadmin/webhook-config` (AAOS-SETTINGS-WEBHOOK-CONFIG, Part C) — the GLOBAL
   * (not per-tenant) Meta/WhatsApp webhook verify-token + app-secret override status. Same
   * perimeter as every other endpoint on this controller (`ApiKeyGuard`, the real
   * `role === 'superadmin'` check happening one layer up in `apps/aaos-dashboard`'s
   * `/api/superadmin/*` route — see class doc).
   */
  @Get("webhook-config")
  async getWebhookConfig(): Promise<WebhookConfigResponseDto> {
    return this.service.getWebhookConfig();
  }

  @Put("webhook-config")
  async updateWebhookConfig(
    @Body(new ZodValidationPipe(PutWebhookConfigBodySchema)) body: PutWebhookConfigBodyDto,
  ): Promise<WebhookConfigResponseDto> {
    return this.service.updateWebhookConfig(body);
  }
}
