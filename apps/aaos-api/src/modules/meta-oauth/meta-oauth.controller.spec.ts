import "reflect-metadata";

import type { FastifyReply } from "fastify";
import { describe, expect, it, vi } from "vitest";

import { MetaOAuthController } from "./meta-oauth.controller.js";
import type { MetaOAuthService } from "./meta-oauth.service.js";
import type { WaOAuthService } from "./wa-oauth.service.js";

function buildFakeReply(): FastifyReply {
  const reply = {
    status: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply as unknown as FastifyReply;
}

describe("MetaOAuthController", () => {
  it("connectMeta delegates to MetaOAuthService.generateOAuthUrl with the query tenantId", async () => {
    const metaOAuth = {
      generateOAuthUrl: vi.fn(async () => ({ authorizeUrl: "https://x" })),
    } as unknown as MetaOAuthService;
    const waOAuth = {} as unknown as WaOAuthService;
    const controller = new MetaOAuthController(metaOAuth, waOAuth);
    const result = await controller.connectMeta("dss-motor");
    expect(metaOAuth.generateOAuthUrl).toHaveBeenCalledWith("dss-motor");
    expect(result.authorizeUrl).toBe("https://x");
  });

  it("metaCallback delegates to MetaOAuthService.handleCallback with code/state/error", async () => {
    const metaOAuth = {
      handleCallback: vi.fn(async () => ({ success: true, message: "ok" })),
    } as unknown as MetaOAuthService;
    const waOAuth = {} as unknown as WaOAuthService;
    const controller = new MetaOAuthController(metaOAuth, waOAuth);
    const result = await controller.metaCallback("code-1", "state-1", undefined);
    expect(metaOAuth.handleCallback).toHaveBeenCalledWith("code-1", "state-1", undefined);
    expect(result.success).toBe(true);
  });

  it("disconnectMeta delegates to MetaOAuthService.disconnect", async () => {
    const metaOAuth = { disconnect: vi.fn(async () => undefined) } as unknown as MetaOAuthService;
    const waOAuth = {} as unknown as WaOAuthService;
    const controller = new MetaOAuthController(metaOAuth, waOAuth);
    const result = await controller.disconnectMeta("dss-motor");
    expect(metaOAuth.disconnect).toHaveBeenCalledWith("dss-motor");
    expect(result).toEqual({ success: true });
  });

  it("waEmbeddedSignup delegates to WaOAuthService.handleEmbeddedSignupToken", async () => {
    const metaOAuth = {} as unknown as MetaOAuthService;
    const waOAuth = {
      handleEmbeddedSignupToken: vi.fn(async () => ({ success: true, message: "connected" })),
    } as unknown as WaOAuthService;
    const controller = new MetaOAuthController(metaOAuth, waOAuth);
    const result = await controller.waEmbeddedSignup({
      tenantId: "dss-motor",
      token: "TOKEN",
      branchId: "pusat",
    });
    expect(waOAuth.handleEmbeddedSignupToken).toHaveBeenCalledWith("dss-motor", "TOKEN", "pusat");
    expect(result.success).toBe(true);
  });

  it("waManual delegates to WaOAuthService.setupManual", async () => {
    const metaOAuth = {} as unknown as MetaOAuthService;
    const body = {
      tenantId: "dss-motor",
      branchId: "pusat",
      wabaId: "waba-1",
      phoneNumberId: "phone-1",
      phoneNumber: "+62",
      accessToken: "TOKEN",
    };
    const waOAuth = {
      setupManual: vi.fn(async () => ({ success: true, message: "ok" })),
    } as unknown as WaOAuthService;
    const controller = new MetaOAuthController(metaOAuth, waOAuth);
    await controller.waManual(body);
    expect(waOAuth.setupManual).toHaveBeenCalledWith("dss-motor", body);
  });

  it("verifyWaWebhook replies 200 + raw challenge on success", async () => {
    const metaOAuth = {} as unknown as MetaOAuthService;
    const waOAuth = {
      verifyWebhook: vi.fn(async () => ({ ok: true, challenge: "chal-1" })),
    } as unknown as WaOAuthService;
    const controller = new MetaOAuthController(metaOAuth, waOAuth);
    const reply = buildFakeReply();
    await controller.verifyWaWebhook("subscribe", "token", "chal-1", reply);
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith("chal-1");
  });

  it("verifyWaWebhook replies 403 + message on failure", async () => {
    const metaOAuth = {} as unknown as MetaOAuthService;
    const waOAuth = {
      verifyWebhook: vi.fn(async () => ({ ok: false, message: "mismatch" })),
    } as unknown as WaOAuthService;
    const controller = new MetaOAuthController(metaOAuth, waOAuth);
    const reply = buildFakeReply();
    await controller.verifyWaWebhook("subscribe", "wrong", "chal-1", reply);
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith("mismatch");
  });

  it("status composes MetaOAuthService.getMetaStatus + WaOAuthService.getStatus", async () => {
    const metaOAuth = {
      getMetaStatus: vi.fn(async () => ({ connected: true, source: "oauth" as const })),
    } as unknown as MetaOAuthService;
    const waOAuth = {
      getStatus: vi.fn(async () => ({ connected: false, configs: [] })),
    } as unknown as WaOAuthService;
    const controller = new MetaOAuthController(metaOAuth, waOAuth);
    const result = await controller.status("dss-motor");
    expect(result.meta.connected).toBe(true);
    expect(result.whatsapp.connected).toBe(false);
  });
});
