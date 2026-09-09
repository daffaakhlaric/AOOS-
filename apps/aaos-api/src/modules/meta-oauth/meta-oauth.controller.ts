import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";

import { ZodValidationPipe } from "../../pipes/zod-validation.pipe.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import {
  EmbeddedSignupBodySchema,
  SetupManualBodySchema,
  type EmbeddedSignupBodyDto,
  type OAuthCallbackResponseDto,
  type OAuthConnectResponseDto,
  type OAuthStatusResponseDto,
  type SetupManualBodyDto,
} from "./dto/meta-oauth.dto.js";
import { MetaOAuthService } from "./meta-oauth.service.js";
import { WaOAuthService } from "./wa-oauth.service.js";

/**
 * `/oauth/*` (Sprint 2 — EYVRA-META-OAUTH-WHATSAPP-SETUP, Prompt 5). Deliberately top-level
 * `/oauth/*`, not nested under `/api/v1/*` — mirrors `WhatsAppWebhookController`'s own
 * `webhooks/whatsapp` precedent of a real external caller (Meta) needing a stable, simple path
 * outside this app's authenticated API surface, and matches the pasted spec's own literal route
 * shapes (`GET /oauth/meta/connect`, `GET /oauth/meta/callback`, etc.) rather than renaming them
 * under a versioned prefix nothing else in this sprint's spec expects.
 *
 * AUTH — investigated this codebase's real, established precedent before choosing per-route:
 *   - `ApiKeyGuard` (the same `x-api-key` perimeter `SettingsController`/`SosmedOAuthController`
 *     already use for tenant-scoped write/read actions) on every route a manager's own
 *     authenticated dashboard session calls: starting the Meta OAuth redirect, submitting an
 *     Embedded Signup/manual WhatsApp setup, reading connection status, disconnecting.
 *   - NO guard on `oauth/meta/callback` and `oauth/webhook/wa/:tenantId` — Meta's own servers hit
 *     these, not an authenticated browser session (a top-level OAuth redirect cannot carry a
 *     custom header either). Mirrors `WhatsAppWebhookController`'s exact real distinction: its GET
 *     handshake has no guard (the `hub.verify_token` IS the auth), matched here by
 *     `WaOAuthService.verifyWebhook`'s own real `hub.verify_token` check
 *     (`WebhookSecretsService.getWhatsappSecrets().verifyToken`, this codebase's already-
 *     established WhatsApp webhook-verify-token concept, reused rather than reinvented). The Meta
 *     OAuth callback is secured by `MetaOAuthService.handleCallback`'s own real, single-use,
 *     expiring `oauth_states` CSRF `state` validation — the same real mechanism
 *     `SosmedOAuthController`'s public callback routes rely on instead of `ApiKeyGuard`.
 */
@Controller("oauth")
export class MetaOAuthController {
  constructor(
    private readonly metaOAuth: MetaOAuthService,
    private readonly waOAuth: WaOAuthService,
  ) {}

  // -----------------------------------------------------------------------------------------
  // Meta Ads OAuth (Facebook Login).
  // -----------------------------------------------------------------------------------------

  @Get("meta/connect")
  @UseGuards(ApiKeyGuard)
  async connectMeta(@Query("tenantId") tenantId: string): Promise<OAuthConnectResponseDto> {
    return this.metaOAuth.generateOAuthUrl(tenantId);
  }

  /** PUBLIC — Meta redirects the manager's own browser here after consent. */
  @Get("meta/callback")
  @HttpCode(200)
  async metaCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
  ): Promise<OAuthCallbackResponseDto> {
    return this.metaOAuth.handleCallback(code, state, error);
  }

  @Delete("meta/disconnect")
  @UseGuards(ApiKeyGuard)
  @HttpCode(200)
  async disconnectMeta(@Query("tenantId") tenantId: string): Promise<{ readonly success: true }> {
    await this.metaOAuth.disconnect(tenantId);
    return { success: true };
  }

  // -----------------------------------------------------------------------------------------
  // WhatsApp Business Embedded Signup / manual setup.
  // -----------------------------------------------------------------------------------------

  @Post("wa/embedded-signup")
  @UseGuards(ApiKeyGuard)
  @HttpCode(200)
  async waEmbeddedSignup(
    @Body(new ZodValidationPipe(EmbeddedSignupBodySchema)) body: EmbeddedSignupBodyDto,
  ): Promise<OAuthCallbackResponseDto> {
    return this.waOAuth.handleEmbeddedSignupToken(body.tenantId, body.token, body.branchId);
  }

  @Post("wa/manual")
  @UseGuards(ApiKeyGuard)
  @HttpCode(200)
  async waManual(
    @Body(new ZodValidationPipe(SetupManualBodySchema)) body: SetupManualBodyDto,
  ): Promise<OAuthCallbackResponseDto> {
    return this.waOAuth.setupManual(body.tenantId, body);
  }

  /**
   * PUBLIC — `hub.mode`/`hub.verify_token` subscription handshake, mirrors
   * `WhatsAppWebhookController.handshake` exactly: 200 + raw challenge text on success, 403 +
   * message on a token mismatch.
   */
  @Get("webhook/wa/:tenantId")
  async verifyWaWebhook(
    @Query("hub.mode") mode: string | undefined,
    @Query("hub.verify_token") token: string | undefined,
    @Query("hub.challenge") challenge: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.waOAuth.verifyWebhook(mode, token, challenge);
    if (result.ok) {
      void reply.status(200).type("text/plain").send(result.challenge);
      return;
    }
    void reply.status(403).type("text/plain").send(result.message);
  }

  // -----------------------------------------------------------------------------------------
  // Status.
  // -----------------------------------------------------------------------------------------

  @Get("status/:tenantId")
  @UseGuards(ApiKeyGuard)
  async status(@Param("tenantId") tenantId: string): Promise<OAuthStatusResponseDto> {
    const [meta, whatsapp] = await Promise.all([
      this.metaOAuth.getMetaStatus(tenantId),
      this.waOAuth.getStatus(tenantId),
    ]);
    return { meta, whatsapp };
  }
}
