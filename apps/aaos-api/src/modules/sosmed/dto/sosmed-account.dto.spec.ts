import { describe, expect, it } from "vitest";

import type { SosmedAccountRow } from "../infrastructure/sosmed-account.repository.js";

import { toSosmedAccountDto } from "./sosmed-account.dto.js";

const ROW: SosmedAccountRow = {
  id: "acc-1",
  tenant_id: "dss-motor",
  sales_human_id: null,
  platform: "FACEBOOK",
  account_type: "OFFICIAL",
  account_name: "Mobix by DSS Motor",
  username: null,
  page_id: "page-1",
  instagram_account_id: null,
  access_token: "EAABsbCS1234567890abcdefSECRET",
  token_expires_at: null,
  follower_count: 12400,
  profile_pic_url: null,
  status: "CONNECTED",
  last_sync_at: null,
  created_at: "2026-08-24T00:00:00.000Z",
};

describe("toSosmedAccountDto", () => {
  it("never returns the raw access_token anywhere in the response fixture", () => {
    const dto = toSosmedAccountDto(ROW);
    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain(ROW.access_token);
    expect(serialized).not.toContain("SECRET");
  });

  it("exposes only a masked tail, matching WabaConfigResponseDto/TenantResponseDto's discipline", () => {
    const dto = toSosmedAccountDto(ROW);
    // maskTail(value, 4) keeps the first 4 chars visible, masks the rest with 'x'.
    expect(dto.maskedAccessToken.startsWith("EAAB")).toBe(true);
    expect(dto.maskedAccessToken).not.toBe(ROW.access_token);
    expect(dto.maskedAccessToken).toMatch(/^EAABx+$/);
  });

  it("maps every other field faithfully (row -> camelCase dto)", () => {
    const dto = toSosmedAccountDto(ROW);
    expect(dto).toMatchObject({
      id: "acc-1",
      tenantId: "dss-motor",
      platform: "FACEBOOK",
      accountType: "OFFICIAL",
      accountName: "Mobix by DSS Motor",
      pageId: "page-1",
      followerCount: 12400,
      status: "CONNECTED",
      createdAt: "2026-08-24T00:00:00.000Z",
    });
    expect(dto.salesHumanId).toBeUndefined();
    expect(dto.username).toBeUndefined();
    expect(dto.instagramAccountId).toBeUndefined();
  });

  it("includes salesHumanId when the row has one (SALES_PERSONAL accounts)", () => {
    const dto = toSosmedAccountDto({
      ...ROW,
      sales_human_id: "sales-1",
      account_type: "SALES_PERSONAL",
    });
    expect(dto.salesHumanId).toBe("sales-1");
    expect(dto.accountType).toBe("SALES_PERSONAL");
  });
});
