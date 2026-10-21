import { UnavailableError, ValidationError } from "@aos/errors";
import { Inject, Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { MetaOAuthService } from "../meta-oauth/meta-oauth.service.js";

export interface LeadPage {
  id: string;
  name: string;
}
/**
 * A real, verified WhatsApp Business phone number, sourced from the tenant's Meta Business
 * (`{business}/owned_whatsapp_business_accounts` -> `{waba}/phone_numbers`) — NOT from any
 * per-Page field. See this file's class doc for why a Page-level lookup doesn't work.
 */
export interface LeadWhatsAppNumber {
  phoneNumberId: string;
  displayNumber: string;
  wabaId: string;
  wabaName: string;
  qualityRating?: string;
}
interface GraphOwnedPages {
  data?: { id: string; name: string }[];
  paging?: { next?: string; cursors?: { after?: string } };
}
export interface LeadDestinations {
  adAccountId: string;
  pages: LeadPage[];
  whatsappNumbers: LeadWhatsAppNumber[];
  warning?: string;
}
@Injectable()
export class MetaLeadDestinationsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: SupabaseClient,
    private readonly oauth: MetaOAuthService,
  ) {}

  /**
   * `GET /api/v1/listings/lead-destinations` — real Page and WhatsApp Business options for the
   * tenant's connected Meta ad account, for the Listing Editor's "Kontak & Tujuan Lead" picker.
   *
   * Pages and WhatsApp numbers are fetched from TWO SEPARATE, INDEPENDENT real Graph API surfaces
   * and presented as two independent choices — same as Meta Ads Manager's own Click-to-WhatsApp
   * flow, which does not require a Page to be pre-linked to a specific WhatsApp number:
   *   - Pages: `act_{account}/promote_pages` (falls back to `{business}/owned_pages` when the
   *     account has none of its own).
   *   - WhatsApp numbers: `act_{account}` -> `business` -> `{business}/owned_whatsapp_business_accounts`
   *     -> `{waba}/phone_numbers`. This is the real, documented WhatsApp Business Account object
   *     graph — the only place a verified, usable phone number actually lives.
   *
   * A prior version of this method requested `whatsapp_number`/`has_whatsapp_business_number` as
   * fields directly on the Page node and joined a chosen Page 1:1 to that value. Verified against
   * this app's real PROPERTY tenant (`agen-pintar-indonesia`, 3 real Pages, full
   * `whatsapp_business_management` permission granted): Meta's Graph API accepted those field
   * names without error but silently returned nothing for any of the 3 Pages, while
   * `{business}/owned_whatsapp_business_accounts` -> `phone_numbers` returned 2 real, verified
   * (`quality_rating: "GREEN"`) numbers for the same business. The Page-level fields are not a
   * working source for this data; this rewrite stops requesting them and sources numbers from the
   * Business/WABA graph instead. `validate()` below was rejoined to match.
   */
  async list(tenantId: string): Promise<LeadDestinations> {
    const { data: tenant, error } = await this.db
      .from("tenants")
      .select("meta_ad_account_id,meta_api_version")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error || !tenant) throw new UnavailableError("Koneksi Meta workspace belum tersedia.");
    const account = String(tenant.meta_ad_account_id ?? "").replace(/^act_/, "");
    if (!/^\d+$/.test(account))
      throw new UnavailableError("Pilih akun iklan Meta di Settings terlebih dahulu.");
    // Manual and OAuth credentials both use encrypted storage; never revive plaintext fallback.
    const token = await this.oauth.getToken(tenantId);
    if (!token)
      throw new UnavailableError("Hubungkan Meta Ads di Settings untuk memuat Page dan WhatsApp.");
    const version = /^v\d+\.\d+$/.test(tenant.meta_api_version ?? "")
      ? tenant.meta_api_version
      : "v22.0";
    const adAccountId = `act_${account}`;
    const pagesResult = await this.fetchPages(adAccountId, version, token);
    const numbersResult = await this.fetchWhatsAppNumbers(adAccountId, version, token);
    const warning = [pagesResult.warning, numbersResult.warning].filter(Boolean).join(" ");
    return {
      adAccountId,
      pages: pagesResult.pages,
      whatsappNumbers: numbersResult.numbers,
      ...(warning ? { warning } : {}),
    };
  }

  private async fetchPages(
    adAccountId: string,
    version: string,
    token: string,
  ): Promise<{ pages: LeadPage[]; warning?: string }> {
    const pages: LeadPage[] = [];
    let after: string | undefined;
    for (let batch = 0; batch < 20; batch++) {
      const url = new URL(`https://graph.facebook.com/${version}/${adAccountId}/promote_pages`);
      url.searchParams.set("fields", "id,name");
      url.searchParams.set("limit", "100");
      if (after) url.searchParams.set("after", after);
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        throw new UnavailableError("Meta tidak dapat dijangkau. Coba muat ulang tujuan lead.");
      }
      if (!response.ok)
        throw new UnavailableError(
          "Meta menolak akses Page/WhatsApp. Periksa koneksi dan izin aset akun iklan di Settings.",
        );
      const body = (await response.json()) as GraphOwnedPages;
      if (!Array.isArray(body.data)) throw new UnavailableError("Respons aset Meta tidak valid.");
      for (const page of body.data) pages.push({ id: page.id, name: page.name });
      if (!body.paging?.next) {
        if (pages.length) return { pages };
        return this.businessPages(adAccountId, version, token);
      }
      after = body.paging.cursors?.after;
      if (!after) break;
    }
    throw new UnavailableError(
      "Daftar Page Meta terlalu besar atau pagination tidak lengkap. Periksa akses aset di Settings.",
    );
  }

  private async businessPages(
    adAccountId: string,
    version: string,
    token: string,
  ): Promise<{ pages: LeadPage[]; warning?: string }> {
    const read = graphReader(version, token);
    const owner = await read<{ business?: { id?: string } }>(`${adAccountId}?fields=business`);
    const businessId = owner.business?.id;
    if (typeof businessId !== "string" || !/^\d+$/.test(businessId)) return { pages: [] };
    const pages: LeadPage[] = [];
    let after = "";
    for (let batch = 0; batch < 20; batch++) {
      const body = await read<GraphOwnedPages>(
        `${businessId}/owned_pages?fields=id,name&limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`,
      );
      if (!Array.isArray(body.data))
        throw new UnavailableError("Respons Page Business Manager tidak valid.");
      for (const page of body.data) pages.push({ id: page.id, name: page.name });
      if (!body.paging?.next) break;
      after = body.paging.cursors?.after ?? "";
      if (!after || batch === 19)
        throw new UnavailableError("Daftar Page Business Manager belum lengkap.");
    }
    return {
      pages,
      warning:
        "Page ditemukan di Business Manager, tetapi belum dikonfirmasi dapat dipakai oleh akun iklan. Periksa penetapan Page ke akun iklan.",
    };
  }

  /**
   * Real WhatsApp numbers for the account's Business — see this class's doc for why this replaces
   * the old per-Page lookup. Failures here degrade honestly (empty list + a real explanation)
   * rather than failing the whole request: a tenant should still be able to pick a Page even if
   * WhatsApp Business access isn't set up yet.
   */
  private async fetchWhatsAppNumbers(
    adAccountId: string,
    version: string,
    token: string,
  ): Promise<{ numbers: LeadWhatsAppNumber[]; warning?: string }> {
    const read = graphReader(version, token);
    let businessId: string | undefined;
    try {
      const owner = await read<{ business?: { id?: string } }>(`${adAccountId}?fields=business`);
      businessId = owner.business?.id;
    } catch {
      return {
        numbers: [],
        warning: "Nomor WhatsApp Business tidak dapat dimuat: akses Business Manager ditolak.",
      };
    }
    if (typeof businessId !== "string" || !/^\d+$/.test(businessId)) {
      return {
        numbers: [],
        warning:
          "Akun iklan ini belum terhubung ke Business Manager — nomor WhatsApp tidak dapat dimuat.",
      };
    }
    let wabas: { id: string; name: string }[];
    try {
      const body = await read<{ data?: { id: string; name: string }[] }>(
        `${businessId}/owned_whatsapp_business_accounts?fields=id,name&limit=100`,
      );
      wabas = body.data ?? [];
    } catch {
      return {
        numbers: [],
        warning:
          "Nomor WhatsApp Business tidak dapat dimuat: periksa izin WhatsApp Business Management pada koneksi Meta.",
      };
    }
    const numbers: LeadWhatsAppNumber[] = [];
    for (const waba of wabas) {
      try {
        const body = await read<{
          data?: { id: string; display_phone_number: string; quality_rating?: string }[];
        }>(`${waba.id}/phone_numbers?fields=id,display_phone_number,quality_rating&limit=100`);
        for (const phone of body.data ?? [])
          numbers.push({
            phoneNumberId: phone.id,
            displayNumber: phone.display_phone_number,
            wabaId: waba.id,
            wabaName: waba.name,
            ...(phone.quality_rating ? { qualityRating: phone.quality_rating } : {}),
          });
      } catch {
        // One WABA's numbers failing to load shouldn't hide the others.
      }
    }
    if (numbers.length === 0 && wabas.length > 0)
      return {
        numbers,
        warning: "WhatsApp Business Account ditemukan, tetapi belum ada nomor terverifikasi.",
      };
    return { numbers };
  }

  async validate(
    tenantId: string,
    pageId: string,
    adAccountId: string,
    number: string,
  ): Promise<string> {
    const assets = await this.list(tenantId);
    const digits = (value: string) => value.replace(/\D/g, "");
    const page = assets.pages.find((p) => p.id === pageId);
    const match = assets.whatsappNumbers.find((w) => digits(w.displayNumber) === digits(number));
    if (assets.adAccountId !== adAccountId || !page || !match)
      throw new ValidationError(
        "Tujuan WhatsApp tidak cocok dengan Page dan akun iklan Meta workspace ini. Muat ulang pilihan.",
      );
    return match.displayNumber;
  }
}

/** Shared minimal Graph GET helper: Bearer auth, 15s timeout, one honest error on a non-2xx. */
function graphReader(version: string, token: string) {
  return async function read<T>(path: string): Promise<T> {
    const response = await fetch(`https://graph.facebook.com/${version}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new UnavailableError(
        "Meta menolak akses aset Business Manager. Periksa izin bisnis pada koneksi Meta.",
      );
    return (await response.json()) as T;
  };
}
