import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";

import type { MetaOAuthService } from "../meta-oauth/meta-oauth.service.js";

import { MetaLeadDestinationsService } from "./meta-lead-destinations.service.js";
function setup() {
  const eq = vi.fn(() => ({
    maybeSingle: async () => ({
      error: null,
      data: {
        meta_ad_account_id: "123",
        meta_access_token: "secret",
        meta_api_version: "v22.0",
        meta_connection_source: "manual",
      },
    }),
  }));
  const db = { from: () => ({ select: () => ({ eq }) }) } as unknown as SupabaseClient;
  return { service: new MetaLeadDestinationsService(db, {} as MetaOAuthService), eq };
}
afterEach(() => vi.unstubAllGlobals());
it("discovers owned Pages only from the configured account business and explains denied WhatsApp access", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ business: { id: "456" } }) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "7", name: "Business Page", whatsapp_number: "+62812" }] }),
    })
    .mockResolvedValueOnce({ ok: false });
  vi.stubGlobal("fetch", fetcher);
  const result = await setup().service.list("tenant-a");
  expect(result.pages).toEqual([{ id: "7", name: "Business Page", whatsappNumber: null }]);
  expect(result.warning).toContain("WhatsApp Business Management");
  expect(String(fetcher.mock.calls[2]?.[0])).toContain("/456/owned_pages");
});
it("scopes discovery to the tenant configured account, follows cursors and never returns tokens", async () => {
  const { service, eq } = setup();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: "1", name: "Page", whatsapp_number: "+62812", has_whatsapp_business_number: true },
        ],
        paging: {
          next: "https://untrusted.invalid/?access_token=secret",
          cursors: { after: "cursor" },
        },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "2", name: "No WA", whatsapp_number: "123" }] }),
    });
  vi.stubGlobal("fetch", fetcher);
  const result = await service.list("tenant-a");
  expect(eq).toHaveBeenCalledWith("tenant_id", "tenant-a");
  expect(result.pages[1]?.whatsappNumber).toBeNull();
  expect(JSON.stringify(result)).not.toContain("secret");
  expect(String(fetcher.mock.calls[1]?.[0])).toContain(
    "graph.facebook.com/v22.0/act_123/promote_pages",
  );
  expect(String(fetcher.mock.calls[1]?.[0])).toContain("after=cursor");
});
it("rejects mismatched account, page, number and pages without business WhatsApp", async () => {
  const { service } = setup();
  vi.spyOn(service, "list").mockResolvedValue({
    adAccountId: "act_123",
    pages: [{ id: "1", name: "Page", whatsappNumber: "+62812" }],
  });
  await expect(service.validate("t", "1", "act_456", "+62812")).rejects.toThrow();
  await expect(service.validate("t", "2", "act_123", "+62812")).rejects.toThrow();
  await expect(service.validate("t", "1", "act_123", "+62899")).rejects.toThrow();
  await expect(service.validate("t", "1", "act_123", "+62 812")).resolves.toBe("+62812");
});
it("returns a safe actionable error on denied Meta permissions", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false })),
  );
  await expect(setup().service.list("t")).rejects.toThrow("Periksa koneksi dan izin");
});
