import { MetaApiClient } from "@aos/meta-ads-connector";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TrustedTenantContext } from "../auth/tenant-authorization.service.js";

import { MetaExecutionReadinessService } from "./meta-execution-readiness.service.js";

describe("Meta destination selection", () => {
  const identity = { tenantId: "tenant-a" } as TrustedTenantContext;
  const update = vi.fn();
  const invalidate = vi.fn();
  let service: MetaExecutionReadinessService;
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    update.mockReset().mockResolvedValue({});
    invalidate.mockReset();
    vi.spyOn(MetaApiClient.prototype, "readGraph").mockResolvedValue({
      ok: true,
      value: { data: [{ id: "11" }] },
    });
    service = new MetaExecutionReadinessService(
      {
        invalidate,
        resolve: async () => ({
          ok: true,
          value: { credentialVersion: 3, accessToken: "fixture" },
        }),
      } as never,
      {} as never,
      { updateMetaAtVersion: update } as never,
    );
    vi.spyOn(service, "resources").mockResolvedValue({
      credentialVersion: 3,
      selectedAdAccountId: "act_1",
      selectedPageId: null,
      selectedInstagramId: null,
      selectedWhatsAppNumber: null,
      accounts: [],
      pages: [{ id: "11", name: "Page A" }],
      instagramAccounts: [{ id: "22", pageId: "11" }],
      whatsappNumbers: [
        { phoneNumberId: "33", displayNumber: "+62 812345678", wabaId: "44", wabaName: "Business" },
      ],
      issues: [],
    });
  });
  it.each([
    { credentialVersion: 2, pageId: "11" },
    { credentialVersion: 3, pageId: "99" },
    { credentialVersion: 3, pageId: "11", instagramId: "99" },
    { credentialVersion: 3, pageId: "11", whatsappNumber: "+62 999999999" },
  ])("rejects stale or unverified selection %#", async (input) => {
    await expect(service.selectDestinations(identity, input)).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
  it("persists validated destinations in the trusted tenant at the expected version", async () => {
    const result = await service.selectDestinations(identity, {
      credentialVersion: 3,
      pageId: "11",
      instagramId: "22",
      whatsappNumber: "+62 812345678",
    });
    expect(update).toHaveBeenCalledWith("tenant-a", 3, {
      meta_page_id: "11",
      meta_instagram_id: "22",
      meta_whatsapp_destination: "+62 812345678",
    });
    expect(invalidate).toHaveBeenCalledWith("tenant-a");
    expect(result.executionTier).toBe("READ_ONLY");
  });
  it("does not report success when a concurrent credential change wins", async () => {
    update.mockRejectedValue(new Error("Integration changed"));
    await expect(
      service.selectDestinations(identity, { credentialVersion: 3, pageId: "11" }),
    ).rejects.toThrow("Integration changed");
    expect(invalidate).not.toHaveBeenCalled();
  });
  it("rejects a business Page without account advertising assignment", async () => {
    vi.mocked(MetaApiClient.prototype.readGraph).mockResolvedValue({
      ok: true,
      value: { data: [] },
    });
    await expect(
      service.selectDestinations(identity, { credentialVersion: 3, pageId: "11" }),
    ).rejects.toThrow("advertising assignment");
    expect(update).not.toHaveBeenCalled();
  });
});
