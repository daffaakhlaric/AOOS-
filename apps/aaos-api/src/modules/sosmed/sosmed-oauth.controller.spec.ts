import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { SosmedOAuthService } from "./application/sosmed-oauth.service.js";
import { SosmedOAuthController } from "./sosmed-oauth.controller.js";

function buildFakeOAuthService(): SosmedOAuthService {
  return {
    startOfficialOAuth: vi.fn(() => ({
      authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth?...",
    })),
    handleOfficialCallback: vi.fn(async () => ({
      success: true,
      message: "2 akun berhasil terhubung.",
    })),
    createSalesConnectLink: vi.fn(async () => ({
      token: "TOKEN",
      expiresAt: "2026-08-25T10:00:00.000Z",
      connectUrl: "https://dashboard.example.com/connect/sales/TOKEN",
    })),
    startSalesOAuth: vi.fn(async () => ({
      authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth?...",
    })),
    handleSalesCallback: vi.fn(async () => ({
      success: true,
      message: "1 akun berhasil terhubung.",
    })),
    listAccounts: vi.fn(async () => []),
    disconnectAccount: vi.fn(async () => undefined),
  } as unknown as SosmedOAuthService;
}

function guardsFor(target: object, methodName?: string): unknown[] {
  const key = methodName === undefined ? target : (target as never)[methodName];
  return (Reflect.getMetadata("__guards__", key) as unknown[] | undefined) ?? [];
}

describe("SosmedOAuthController", () => {
  it("GET oauth/official/start delegates to SosmedOAuthService.startOfficialOAuth and is ApiKeyGuard-protected", () => {
    const service = buildFakeOAuthService();
    const controller = new SosmedOAuthController(service);
    const result = controller.startOfficialOAuth();
    expect(service.startOfficialOAuth).toHaveBeenCalled();
    expect(result.authorizeUrl).toContain("dialog/oauth");
    expect(guardsFor(controller, "startOfficialOAuth")).toContain(ApiKeyGuard);
  });

  it("GET oauth/official/callback delegates to SosmedOAuthService.handleOfficialCallback and is PUBLIC (no ApiKeyGuard)", async () => {
    const service = buildFakeOAuthService();
    const controller = new SosmedOAuthController(service);
    const query = { code: "CODE", state: "STATE" };
    const result = await controller.officialCallback(query);
    expect(service.handleOfficialCallback).toHaveBeenCalledWith(query);
    expect(result.success).toBe(true);
    expect(guardsFor(controller, "officialCallback")).not.toContain(ApiKeyGuard);
  });

  it("POST oauth/sales/connect-links delegates to SosmedOAuthService.createSalesConnectLink and is ApiKeyGuard-protected", async () => {
    const service = buildFakeOAuthService();
    const controller = new SosmedOAuthController(service);
    const result = await controller.createSalesConnectLink({ salesHumanId: "sales-1" });
    expect(service.createSalesConnectLink).toHaveBeenCalledWith("sales-1");
    expect(result.token).toBe("TOKEN");
    expect(guardsFor(controller, "createSalesConnectLink")).toContain(ApiKeyGuard);
  });

  it("GET oauth/sales/:token/start delegates to SosmedOAuthService.startSalesOAuth and is PUBLIC (a sales human's browser has no x-api-key)", async () => {
    const service = buildFakeOAuthService();
    const controller = new SosmedOAuthController(service);
    const result = await controller.startSalesOAuth("TOKEN");
    expect(service.startSalesOAuth).toHaveBeenCalledWith("TOKEN");
    expect(result.authorizeUrl).toContain("dialog/oauth");
    expect(guardsFor(controller, "startSalesOAuth")).not.toContain(ApiKeyGuard);
  });

  it("GET oauth/sales/callback delegates to SosmedOAuthService.handleSalesCallback and is PUBLIC", async () => {
    const service = buildFakeOAuthService();
    const controller = new SosmedOAuthController(service);
    const query = { code: "CODE", state: "STATE" };
    const result = await controller.salesCallback(query);
    expect(service.handleSalesCallback).toHaveBeenCalledWith(query);
    expect(result.success).toBe(true);
    expect(guardsFor(controller, "salesCallback")).not.toContain(ApiKeyGuard);
  });

  it("GET accounts delegates to SosmedOAuthService.listAccounts and is ApiKeyGuard-protected", async () => {
    const service = buildFakeOAuthService();
    const controller = new SosmedOAuthController(service);
    await controller.listAccounts();
    expect(service.listAccounts).toHaveBeenCalled();
    expect(guardsFor(controller, "listAccounts")).toContain(ApiKeyGuard);
  });

  it("DELETE accounts/:id delegates to SosmedOAuthService.disconnectAccount and is ApiKeyGuard-protected", async () => {
    const service = buildFakeOAuthService();
    const controller = new SosmedOAuthController(service);
    await controller.disconnectAccount("acc-1");
    expect(service.disconnectAccount).toHaveBeenCalledWith("acc-1");
    expect(guardsFor(controller, "disconnectAccount")).toContain(ApiKeyGuard);
  });
});
