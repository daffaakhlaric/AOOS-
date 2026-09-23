import { UnavailableError, ValidationError } from "@aos/errors";
import { Inject, Injectable } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { MetaOAuthService } from "../meta-oauth/meta-oauth.service.js";

export interface LeadPage {
  id: string;
  name: string;
  whatsappNumber: string | null;
}
interface GraphOwnedPages {
  data?: { id: string; name: string }[];
  paging?: { next?: string; cursors?: { after?: string } };
}
export interface LeadDestinations {
  adAccountId: string;
  pages: LeadPage[];
  warning?: string;
}
@Injectable()
export class MetaLeadDestinationsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: SupabaseClient,
    private readonly oauth: MetaOAuthService,
  ) {}

  async list(tenantId: string): Promise<LeadDestinations> {
    const { data: tenant, error } = await this.db
      .from("tenants")
      .select("meta_ad_account_id,meta_access_token,meta_connection_source,meta_api_version")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error || !tenant) throw new UnavailableError("Koneksi Meta workspace belum tersedia.");
    const account = String(tenant.meta_ad_account_id ?? "").replace(/^act_/, "");
    if (!/^\d+$/.test(account))
      throw new UnavailableError("Pilih akun iklan Meta di Settings terlebih dahulu.");
    const token =
      tenant.meta_connection_source === "oauth"
        ? await this.oauth.getToken(tenantId)
        : tenant.meta_access_token;
    if (!token)
      throw new UnavailableError("Hubungkan Meta Ads di Settings untuk memuat Page dan WhatsApp.");
    const version = /^v\d+\.\d+$/.test(tenant.meta_api_version ?? "")
      ? tenant.meta_api_version
      : "v22.0";
    const pages: LeadPage[] = [];
    let after: string | undefined;
    for (let batch = 0; batch < 20; batch++) {
      const url = new URL(`https://graph.facebook.com/${version}/act_${account}/promote_pages`);
      url.searchParams.set("fields", "id,name,whatsapp_number,has_whatsapp_business_number");
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
      const body = (await response.json()) as {
        data?: {
          id: string;
          name: string;
          whatsapp_number?: string;
          has_whatsapp_business_number?: boolean;
        }[];
        paging?: { next?: string; cursors?: { after?: string } };
      };
      if (!Array.isArray(body.data)) throw new UnavailableError("Respons aset Meta tidak valid.");
      for (const page of body.data)
        pages.push({
          id: page.id,
          name: page.name,
          whatsappNumber:
            page.has_whatsapp_business_number === true && page.whatsapp_number
              ? page.whatsapp_number
              : null,
        });
      if (!body.paging?.next) {
        if (pages.length) return { adAccountId: `act_${account}`, pages };
        return this.businessPages(`act_${account}`, version, token);
      }
      after = body.paging.cursors?.after;
      if (!after) break;
    }
    throw new UnavailableError(
      "Daftar Page Meta terlalu besar atau pagination tidak lengkap. Periksa akses aset di Settings.",
    );
  }

  private async businessPages(
    account: string,
    version: string,
    token: string,
  ): Promise<LeadDestinations> {
    const read = async <T>(path: string): Promise<T> => {
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
    const owner = await read<{ business?: { id?: string } }>(`${account}?fields=business`);
    const businessId = owner.business?.id;
    if (typeof businessId !== "string" || !/^\d+$/.test(businessId))
      return { adAccountId: account, pages: [] };
    const pages: LeadPage[] = [];
    let after = "";
    for (let batch = 0; batch < 20; batch++) {
      const body = await read<GraphOwnedPages>(
        `${businessId}/owned_pages?fields=id,name,whatsapp_number,has_whatsapp_business_number&limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`,
      );
      if (!Array.isArray(body.data))
        throw new UnavailableError("Respons Page Business Manager tidak valid.");
      for (const page of body.data)
        pages.push({
          id: page.id,
          name: page.name,
          // Business ownership alone does not establish CTWA eligibility.
          whatsappNumber: null,
        });
      if (!body.paging?.next) break;
      // Absent cursor is falsy either way; the next line already treats it as incomplete.
      after = body.paging.cursors?.after ?? "";
      if (!after || batch === 19)
        throw new UnavailableError("Daftar Page Business Manager belum lengkap.");
    }
    let warning =
      "Page ditemukan di Business Manager, tetapi belum dikonfirmasi dapat dipakai oleh akun iklan. Periksa penetapan Page ke akun iklan dan koneksi WhatsApp.";
    try {
      await read(`${businessId}/owned_whatsapp_business_accounts?fields=id,name&limit=1`);
    } catch {
      warning +=
        " Akses WhatsApp Business belum tersedia: periksa izin WhatsApp Business Management pada token serta akses aset bisnis.";
    }
    return { adAccountId: account, pages, warning };
  }

  async validate(tenantId: string, pageId: string, adAccountId: string, number: string) {
    const assets = await this.list(tenantId);
    const page = assets.pages.find((p) => p.id === pageId);
    const digits = (value: string) => value.replace(/\D/g, "");
    if (
      assets.adAccountId !== adAccountId ||
      !page?.whatsappNumber ||
      digits(page.whatsappNumber) !== digits(number)
    )
      throw new ValidationError(
        "Tujuan WhatsApp tidak cocok dengan Page dan akun iklan Meta workspace ini. Muat ulang pilihan.",
      );
    return page.whatsappNumber;
  }
}
