import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { SosmedOAuthService } from "./application/sosmed-oauth.service.js";
import {
  CreateConnectLinkBodySchema,
  OAuthCallbackQuerySchema,
  type CreateConnectLinkBodyDto,
  type CreateConnectLinkResponseDto,
  type OAuthCallbackQueryDto,
  type OAuthCallbackResponseDto,
  type OAuthStartResponseDto,
  type SosmedAccountResponseDto,
} from "./dto/sosmed-account.dto.js";

/**
 * `/api/v1/sosmed/oauth/*` + `/api/v1/sosmed/accounts*` (AAOS-SOSMED-AUTOMATION Phase 4).
 *
 * Deliberately a SEPARATE controller from `SosmedController` (which is entirely
 * `@UseGuards(ApiKeyGuard)`-protected at the class level) rather than adding routes to it, because
 * this controller's routes are a genuine mix of manager-authenticated actions (start an OAuth
 * flow, generate a sales connect-link, list/disconnect accounts — all `x-api-key`-guarded, same as
 * every other write-capable endpoint in this app) and PUBLIC callback/start endpoints that Meta's
 * own redirect and a sales human's un-authenticated browser must be able to reach with no
 * `x-api-key` header at all:
 *   - `oauth/official/callback` — Meta redirects the manager's browser here after consent; browsers
 *     performing a top-level navigation cannot attach a custom header.
 *   - `oauth/sales/:token/start` and `oauth/sales/callback` — a sales human's own phone browser,
 *     which was never issued an `x-api-key`, must be able to reach both. These are gated instead by
 *     the connect-link token's own real, single-use, expiring validity (`SosmedOAuthService`'s
 *     `requireRedeemableConnectToken`) and, for the callback specifically, `OAuthStateStore`'s
 *     single-use CSRF `state` — see that service's class doc for the full security reasoning.
 *
 * This mirrors `WhatsAppWebhookModule`'s already-established precedent for "a real endpoint that
 * MUST stay reachable by an external, unauthenticated caller, secured by a different mechanism
 * than `x-api-key`" (`WhatsAppSignatureGuard`), rather than inventing a new discipline.
 */
@Controller("api/v1/sosmed")
export class SosmedOAuthController {
  constructor(private readonly oauthService: SosmedOAuthService) {}

  // -----------------------------------------------------------------------------------------
  // Official account flow.
  // -----------------------------------------------------------------------------------------

  @Get("oauth/official/start")
  @UseGuards(ApiKeyGuard)
  startOfficialOAuth(): OAuthStartResponseDto {
    return this.oauthService.startOfficialOAuth();
  }

  @Get("oauth/official/callback")
  @HttpCode(200)
  async officialCallback(
    @Query(new ZodValidationPipe(OAuthCallbackQuerySchema)) query: OAuthCallbackQueryDto,
  ): Promise<OAuthCallbackResponseDto> {
    return this.oauthService.handleOfficialCallback(query);
  }

  // -----------------------------------------------------------------------------------------
  // Sales personal-account connect-link flow.
  // -----------------------------------------------------------------------------------------

  @Post("oauth/sales/connect-links")
  @UseGuards(ApiKeyGuard)
  @HttpCode(201)
  async createSalesConnectLink(
    @Body(new ZodValidationPipe(CreateConnectLinkBodySchema)) body: CreateConnectLinkBodyDto,
  ): Promise<CreateConnectLinkResponseDto> {
    return this.oauthService.createSalesConnectLink(body.salesHumanId);
  }

  @Get("oauth/sales/:token/start")
  async startSalesOAuth(@Param("token") token: string): Promise<OAuthStartResponseDto> {
    return this.oauthService.startSalesOAuth(token);
  }

  @Get("oauth/sales/callback")
  @HttpCode(200)
  async salesCallback(
    @Query(new ZodValidationPipe(OAuthCallbackQuerySchema)) query: OAuthCallbackQueryDto,
  ): Promise<OAuthCallbackResponseDto> {
    return this.oauthService.handleSalesCallback(query);
  }

  // -----------------------------------------------------------------------------------------
  // Accounts.
  // -----------------------------------------------------------------------------------------

  @Get("accounts")
  @UseGuards(ApiKeyGuard)
  async listAccounts(): Promise<readonly SosmedAccountResponseDto[]> {
    return this.oauthService.listAccounts();
  }

  @Delete("accounts/:id")
  @UseGuards(ApiKeyGuard)
  @HttpCode(204)
  async disconnectAccount(@Param("id") id: string): Promise<void> {
    await this.oauthService.disconnectAccount(id);
  }
}
