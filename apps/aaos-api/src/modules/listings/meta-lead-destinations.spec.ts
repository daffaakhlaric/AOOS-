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
  return {
    service: new MetaLeadDestinationsService(db, {
      getToken: vi.fn().mockResolvedValue("encrypted-credential"),
    } as unknown as MetaOAuthService),
    eq,
  };
}
/** `act_123?fields=business` — the shared first call both `businessPages` and `fetchWhatsAppNumbers` make. */
function businessLookup() {
  return { ok: true, json: async () => ({ business: { id: "456" } }) };
}
afterEach(() => vi.unstubAllGlobals());

it("discovers owned Pages from the configured account business and real WhatsApp numbers from its owned WABAs", async () => {
  const fetcher = vi
    .fn()
    // 1: act_123/promote_pages -> no pages of its own
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
    // 2: act_123?fields=business (businessPages fallback)
    .mockResolvedValueOnce(businessLookup())
    // 3: 456/owned_pages
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "7", name: "Business Page" }] }),
    })
    // 4: act_123?fields=business (fetchWhatsAppNumbers)
    .mockResolvedValueOnce(businessLookup())
    // 5: 456/owned_whatsapp_business_accounts
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "waba-1", name: "Agen Pintar Indonesia" }] }),
    })
    // 6: waba-1/phone_numbers
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: "phone-1", display_phone_number: "+62 851-1103-7687", quality_rating: "GREEN" },
        ],
      }),
    });
  vi.stubGlobal("fetch", fetcher);
  const result = await setup().service.list("tenant-a");
  expect(result.pages).toEqual([{ id: "7", name: "Business Page" }]);
  expect(result.whatsappNumbers).toEqual([
    {
      phoneNumberId: "phone-1",
      displayNumber: "+62 851-1103-7687",
      wabaId: "waba-1",
      wabaName: "Agen Pintar Indonesia",
      qualityRating: "GREEN",
    },
  ]);
  expect(result.warning).toContain("Page ditemukan di Business Manager");
  expect(String(fetcher.mock.calls[2]?.[0])).toContain("/456/owned_pages");
  expect(String(fetcher.mock.calls[4]?.[0])).toContain("/456/owned_whatsapp_business_accounts");
  expect(String(fetcher.mock.calls[5]?.[0])).toContain("/waba-1/phone_numbers");
});

it("scopes discovery to the tenant configured account, follows Page cursors and never returns tokens", async () => {
  const { service, eq } = setup();
  const fetcher = vi
    .fn()
    // 1: act_123/promote_pages page 1 — has a next cursor
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: "1", name: "Page" }],
        paging: {
          next: "https://untrusted.invalid/?access_token=secret",
          cursors: { after: "cursor" },
        },
      }),
    })
    // 2: act_123/promote_pages page 2 — no next
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "2", name: "Page 2" }] }),
    })
    // 3: act_123?fields=business (fetchWhatsAppNumbers)
    .mockResolvedValueOnce(businessLookup())
    // 4: 456/owned_whatsapp_business_accounts — none owned
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
  vi.stubGlobal("fetch", fetcher);
  const result = await service.list("tenant-a");
  expect(eq).toHaveBeenCalledWith("tenant_id", "tenant-a");
  expect(result.pages).toEqual([
    { id: "1", name: "Page" },
    { id: "2", name: "Page 2" },
  ]);
  expect(result.whatsappNumbers).toEqual([]);
  expect(result.warning).toBeUndefined();
  expect(JSON.stringify(result)).not.toContain("secret");
  expect(String(fetcher.mock.calls[1]?.[0])).toContain(
    "graph.facebook.com/v22.0/act_123/promote_pages",
  );
  expect(String(fetcher.mock.calls[1]?.[0])).toContain("after=cursor");
});

it("reports an honest warning, not an error, when the business owns a WABA with no verified numbers yet", async () => {
  const { service } = setup();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: "1", name: "Page" }] }) })
    .mockResolvedValueOnce(businessLookup())
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "waba-1", name: "Unverified WABA" }] }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
  vi.stubGlobal("fetch", fetcher);
  const result = await service.list("tenant-a");
  expect(result.whatsappNumbers).toEqual([]);
  expect(result.warning).toContain("belum ada nomor terverifikasi");
});

it("rejects mismatched account, page, or number against the real Page and WhatsApp lists", async () => {
  const { service } = setup();
  vi.spyOn(service, "list").mockResolvedValue({
    adAccountId: "act_123",
    pages: [{ id: "1", name: "Page" }],
    whatsappNumbers: [
      { phoneNumberId: "p1", displayNumber: "+62812", wabaId: "w1", wabaName: "WABA" },
    ],
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
